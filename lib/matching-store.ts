import { collection, doc, getDoc, getDocs, getFirestore, increment, runTransaction, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { firebaseApp } from './firebase';
import { ADMIN_EMAIL } from './constants';
import { catalogId, evaluateMatch, normalizeJob, preferences, type CatalogJob, type JobMatch } from './matching';
import { classifyJobFamily } from './jd-intelligence';
import type { Candidate, JobFamily } from './types';
import { ANALYSIS_VERSION, createJDProfile, jdFingerprint, type CachedJD, type JDInput } from './jd-profile';
import { adminAIKey } from './ai-client';
import { aiJDHash, analyzeJDWithLLM, AI_JD_VERSION } from './ai-jd';
import { cachedAIRequest } from './ai-request-store';
import { withReadTimeout } from './read-timeout';
import { publishedPrompt } from './workflow-prompt-store';
import { trackedAI, recordCacheHit } from './llm-usage-store';

const db = getFirestore(firebaseApp, 'chenn');
type BatchOperation = (batch: ReturnType<typeof writeBatch>) => void;
async function commitBatches(operations: BatchOperation[]) {
  // Keep below Firestore's 500-write limit and leave room for future additions.
  for (let index = 0; index < operations.length; index += 400) {
    const batch = writeBatch(db);
    for (const operation of operations.slice(index, index + 400)) operation(batch);
    await batch.commit();
  }
}
export async function cachedJDProfile(user: User, input: JDInput, model?: string): Promise<CachedJD> {
  requireAdmin(user);
  if (model) {
    const key = adminAIKey();
    if (!key) throw new Error('Save your OpenAI API key in Admin Settings first.');
    const prompt = await publishedPrompt('jd-normalization');
    const { hash } = await aiJDHash(input, model, prompt);
    return cachedAIRequest(`jd_${hash}`, () => analyzeJDWithLLM(trackedAI({ key, model }, prompt), input, prompt), () => recordCacheHit('jd-normalization', model));
  }
  const hash = await jdFingerprint(input);
  return runTransaction(db, async tx => {
    const ref = doc(db, 'jdProfiles', hash);
    const existing = await tx.get(ref);
    if (existing.exists()) return existing.data() as CachedJD;
    const result = createJDProfile(input, hash);
    tx.set(ref, result);
    return result;
  });
}
const profileFields = (cached: CachedJD) => ({ jdHash: cached.jdHash, sourceHash: cached.sourceHash ?? cached.jdHash, analysisModel: cached.model ?? '', analysisVersion: cached.analysisVersion, jdProfile: cached.jdProfile, intelligence: cached.intelligence, requirements: cached.requirements, ...(cached.promptSnapshot ? { analysisPrompt: cached.promptSnapshot } : {}) });
export async function ensureCatalogProfile(user: User, jobId: string, model?: string) {
  requireAdmin(user);
  // Retry if an administrator edits the posting while its profile is being prepared.
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = doc(db, 'catalogJobs', jobId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) throw new Error('Shared job no longer exists.');
    const job = { ...snapshot.data(), id: jobId } as CatalogJob;
    if (job.analysisStatus === 'Pending') throw new Error('Analyze this saved job and assign its family before resume generation.');
    const sourceHash = await jdFingerprint(job);
    const current = model ? job.analysisVersion === AI_JD_VERSION && job.analysisModel === model : [ANALYSIS_VERSION, AI_JD_VERSION].includes(job.analysisVersion || '');
    const promptCurrent = !model || job.jdHash === (await aiJDHash(job, model, await publishedPrompt('jd-normalization'))).hash;
    if (job.jdProfile && job.intelligence && current && promptCurrent && (job.sourceHash || job.jdHash) === sourceHash) return job;
    const cached = await cachedJDProfile(user, job, model);
    const result = await runTransaction(db, async tx => {
      const fresh = await tx.get(ref);
      if (!fresh.exists() || await jdFingerprint(fresh.data() as JDInput) !== (cached.sourceHash || cached.jdHash)) return null;
      const fields = profileFields(cached);
      tx.update(ref, fields);
      return { ...fresh.data(), ...fields, id: jobId } as CatalogJob;
    });
    if (result) return result;
  }
  throw new Error('Job changed during analysis. Please try again.');
}
async function readMatchingDataRaw() {
  const [jobs, matches] = await Promise.all([getDocs(collection(db, 'catalogJobs')), getDocs(collection(db, 'jobMatches'))]);
  return { jobs: jobs.docs.map(d => ({ ...d.data(), id: d.id }) as CatalogJob), matches: matches.docs.map(d => ({ ...d.data(), id: d.id }) as JobMatch) };
}
async function expireCatalogJobs() {
  const now = Date.now();
  const snapshot = await getDocs(collection(db, 'catalogJobs'));
  await Promise.all(snapshot.docs.filter(d => d.data().status === 'Open' && Date.parse(String(d.data().expiresAt)) <= now).map(d => updateDoc(d.ref, { status: 'Closed', updatedAt: new Date().toISOString() })));
}
async function recalculateMatches(user: User) {
  const [data, candidateDocs] = await Promise.all([readMatchingDataRaw(), getDocs(collection(db, 'candidates'))]);
  const candidates = candidateDocs.docs.map(d => ({ ...d.data(), id: d.id }) as Candidate);
  const automatic = (await getDoc(doc(db, 'settings', 'platform'))).data()?.autoAssignFamilyMatches === true;
  const readyJobs = data.jobs.filter(job => job.analysisStatus !== 'Pending');
  const previous = new Map(data.matches.map(match => [match.id, match]));
  const matches = readyJobs.flatMap(job => candidates.map(candidate => ({ ...previous.get(`${job.id}_${candidate.id}`), ...evaluateMatch(job, candidate) })));
  await commitBatches(matches.map(match => batch => batch.set(doc(db, 'jobMatches', match.id), match)));
  if (automatic) await assignFamilyMatches(user, readyJobs, candidates, matches);
  return matches.length;
}

async function assignFamilyMatches(user: User, jobs: CatalogJob[], candidates: Candidate[], matches: JobMatch[]) {
  const [settings, applicationDocs] = await Promise.all([
    getDoc(doc(db, 'settings', 'platform')),
    getDocs(collection(db, 'jobs')),
  ]);
  if (settings.data()?.autoAssignFamilyMatches !== true) return 0;
  const jobById = new Map(jobs.map(job => [job.id, job]));
  const candidateById = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const applications = new Set(applicationDocs.docs.map(item => item.id));
  const timestamp = new Date().toISOString();
  let assigned = 0;
  const operations: BatchOperation[] = [];
  for (const match of matches) {
    const job = jobById.get(match.jobId); const candidate = candidateById.get(match.candidateId);
    if (!job || !candidate || match.eligibility !== 'Eligible' || match.reviewedDecision === 'Rejected') continue;
    const applicationId = match.id;
    if (match.applicationId || applications.has(applicationId)) {
      operations.push(batch => batch.set(doc(db, 'jobMatches', match.id), { ...match, reviewedDecision: 'Approved', applicationId }));
      continue;
    }
    const reason = 'Automatically assigned by family taxonomy.';
    operations.push(batch => batch.set(doc(db, 'jobMatches', match.id), { ...match, reviewedDecision: 'Approved', reviewReason: reason, reviewedAt: timestamp, reviewedBy: user.email, applicationId }));
    operations.push(batch => batch.set(doc(db, 'candidateCatalogAccess', candidate.email, 'jobs', job.id), { candidateId: candidate.id }));
    operations.push(batch => batch.set(doc(db, 'jobs', applicationId), { id: applicationId, catalogId: job.id, candidateId: candidate.id,
      status: 'Selected', matchScore: match.score, appliedAt: null, appliedResumeId: null, discoveredAt: timestamp, createdAt: timestamp, updatedAt: timestamp }));
    operations.push(batch => batch.set(doc(db, 'events', `auto_${applicationId}`), { jobId: applicationId, candidateId: candidate.id, eventType: 'match_approved', title: 'Candidate assigned', detail: reason, createdAt: timestamp }));
    operations.push(batch => batch.set(doc(db, 'logs', `auto_${applicationId}`), { actorEmail: user.email, action: 'match.approved', entityType: 'match', entityId: match.id, details: { reason, score: match.score }, createdAt: timestamp }));
    applications.add(applicationId);
    assigned++;
  }
  await commitBatches(operations);
  return assigned;
}
export async function readMatchingData(user: User) {
  requireAdmin(user);
  // Navigation is read-only. Recalculation belongs to explicit matching actions;
  // never hold the catalog hostage to one transaction per job/candidate pair.
  return withReadTimeout((async () => {
    const [data, candidates] = await Promise.all([readMatchingDataRaw(), getDocs(collection(db, 'candidates'))]);
    const byId = new Map(candidates.docs.map(d => [d.id, { ...d.data(), id: d.id } as Candidate]));
    const jobs = new Map(data.jobs.map(job => [job.id, job]));
    // Apply current policy in memory so historical scores never survive a policy change.
    data.matches = data.matches.flatMap(old => {
      const job = jobs.get(old.jobId); const candidate = byId.get(old.candidateId);
      return job && candidate ? [{ ...old, ...evaluateMatch(job, candidate) }] : [];
    });
    return data;
  })());
}
function requireAdmin(user: User) {
  if (!user.emailVerified || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) throw new Error('Verified administrator access required.');
}
export async function importCatalog(user: User, rows: Record<string, unknown>[], pendingAnalysis = false) {
  requireAdmin(user);
  if (!rows.length || rows.length > 100) throw new Error('Import between 1 and 100 jobs.');
  const families = (await getDocs(collection(db, 'families'))).docs.map(d => ({ ...d.data(), id: d.id }) as JobFamily).filter(family => family.active);
  const familyNames = families.map(family => family.name);
  const normalized = await Promise.all(rows.map(async (row, index) => {
    try {
      const classified = pendingAnalysis || row.family ? null : classifyJobFamily(row, families);
      if (classified && classified.confidence < 80) throw new Error('Job family could not be classified confidently. Choose a family before import.');
      const job = normalizeJob({ ...row, workType: row.workType || 'Not specified', ...(pendingAnalysis ? { family: 'Custom / needs review', familyConfidence: 0, mandatorySkills: [], criticalSkills: [], preferredSkills: [] } : {}), ...(classified ? { family: classified.family, familyConfidence: classified.confidence } : {}) }, undefined, true);
      if (!familyNames.includes(job.family) && job.family !== 'Custom / needs review') throw new Error('Choose an active family.');
      return { ...job, id: await catalogId(job) };
    }
    catch (error) { throw new Error(`Row ${index + 1}: ${(error as Error).message}`); }
  }));
  let added = 0;
  for (const job of normalized) {
    const cached = pendingAnalysis ? null : await cachedJDProfile(user, job);
    const created = await runTransaction(db, async tx => {
      const ref = doc(db, 'catalogJobs', job.id); const existing = await tx.get(ref);
      if (existing.exists()) return false;
      tx.set(ref, { ...job, ...(cached ? profileFields(cached) : {}), analysisStatus: pendingAnalysis ? 'Pending' : 'Ready' }); return true;
    });
    if (created) added++;
  }
  return { added, duplicates: rows.length - added };
}
export async function saveCatalogJob(user: User, job: CatalogJob, pendingAnalysis = false) {
  requireAdmin(user); const normalized = normalizeJob(job, undefined, true);
  const current = await getDoc(doc(db, 'catalogJobs', job.id));
  if (!current.exists()) throw new Error('Shared job no longer exists.');
  const allowed = (await getDocs(collection(db, 'families'))).docs.filter(d => d.data().active).map(d => d.data().name);
  if (!allowed.includes(normalized.family) && normalized.family !== 'Custom / needs review') throw new Error('Choose an active family.');
  // Identity fields define deduplication. Keep them stable for existing applications.
  if (await catalogId(normalized) !== await catalogId(current.data() as CatalogJob)) throw new Error('Company, title and location identify a shared job. Import a new vacancy to change these fields.');
  if (!pendingAnalysis && normalized.family === 'Custom / needs review') throw new Error('Assign an active job family before completing analysis.');
  const cached = pendingAnalysis ? null : await cachedJDProfile(user, normalized);
  await setDoc(doc(db, 'catalogJobs', job.id), { ...normalized, ...(cached ? profileFields(cached) : {}), analysisStatus: pendingAnalysis ? 'Pending' : 'Ready', id: job.id });
  if (!pendingAnalysis) await autoAssignFamilyMatches(user, { jobId: job.id });
}
export async function autoAssignFamilyMatches(user: User, scope: { jobId?: string; candidateId?: string } = {}) {
  requireAdmin(user);
  const settings = await getDoc(doc(db, 'settings', 'platform'));
  if (settings.data()?.autoAssignFamilyMatches !== true) return 0;
  const [jobDocs, candidateDocs, matchDocs] = await Promise.all([
    scope.jobId ? getDoc(doc(db, 'catalogJobs', scope.jobId)).then(snapshot => snapshot.exists() ? [snapshot] : []) : getDocs(collection(db, 'catalogJobs')).then(snapshot => snapshot.docs),
    scope.candidateId ? getDoc(doc(db, 'candidates', scope.candidateId)).then(snapshot => snapshot.exists() ? [snapshot] : []) : getDocs(collection(db, 'candidates')).then(snapshot => snapshot.docs),
    getDocs(collection(db, 'jobMatches')),
  ]);
  const jobs = jobDocs.map(item => ({ ...item.data(), id: item.id }) as CatalogJob).filter(job => job.analysisStatus !== 'Pending');
  const candidates = candidateDocs.map(item => ({ ...item.data(), id: item.id }) as Candidate);
  const previous = new Map(matchDocs.docs.map(item => [item.id, { ...item.data(), id: item.id } as JobMatch]));
  const matches = jobs.flatMap(job => candidates.map(candidate => ({ ...previous.get(`${job.id}_${candidate.id}`), ...evaluateMatch(job, candidate) })));
  await commitBatches(matches.map(match => batch => batch.set(doc(db, 'jobMatches', match.id), match)));
  return assignFamilyMatches(user, jobs, candidates, matches);
}
export async function savePreferences(user: User, candidateId: string, input: Parameters<typeof preferences>[0]) {
  requireAdmin(user);
  const value = preferences(input);
  const allowed = (await getDocs(collection(db, 'families'))).docs.filter(d => d.data().active).map(d => d.data().name);
  if (value.secondaryFamilies.some(f => !allowed.includes(f))) throw new Error('Secondary families must come from the active taxonomy.');
  if (!(await getDoc(doc(db, 'candidates', candidateId))).exists()) throw new Error('Candidate not found.');
  await setDoc(doc(db, 'candidates', candidateId), { matchPreferences: value, updatedAt: new Date().toISOString() }, { merge: true });
  await runMatching(user);
}
export async function runMatching(user: User) {
  requireAdmin(user);
  await expireCatalogJobs();
  return recalculateMatches(user);
}
export async function decideMatch(user: User, matchId: string, decision: 'Approved' | 'Rejected', reviewReason: string, automatic = false) {
  requireAdmin(user);
  return runTransaction(db, async tx => {
    const ref = doc(db, 'jobMatches', matchId); const snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw new Error('Match no longer exists.');
    const old = snapshot.data() as JobMatch;
    if (automatic) {
      const settings = await tx.get(doc(db, 'settings', 'platform'));
      if (settings.data()?.autoAssignFamilyMatches !== true || old.applicationId || old.reviewedDecision === 'Rejected') return null;
    }
    const [j, c] = await Promise.all([tx.get(doc(db, 'catalogJobs', old.jobId)), tx.get(doc(db, 'candidates', old.candidateId))]);
    if (!j.exists() || !c.exists()) throw new Error('Job or candidate no longer exists.');
    const fresh = evaluateMatch(j.data() as CatalogJob, c.data() as Candidate);
    if (automatic && fresh.eligibility !== 'Eligible') return null;
    if (old.applicationId) throw new Error('This match already has an application. Manage it under Jobs & JDs.');
    if (decision === 'Approved' && fresh.eligibility === 'Ineligible') throw new Error('This assignment is blocked. Check job family and whether the vacancy is open.');
    if (fresh.decision !== 'Selected' && !reviewReason.trim()) throw new Error('Enter a reason for your review decision.');
    const applicationId = fresh.id;
    const existingApplication = await tx.get(doc(db, 'jobs', applicationId));
    const existing = existingApplication.data();
    if (automatic && existingApplication.exists()) {
      tx.set(ref, { ...old, ...fresh, reviewedDecision: 'Approved', applicationId });
      return applicationId;
    }
    // The earlier demo loader created unreviewed Selected rows. Review adopts
    // those rows in place, preserving identity and preventing a second application.
    const unreviewedDemo = old.jobId.startsWith('demo-job-') && old.candidateId.startsWith('demo-candidate-')
      && existing?.catalogId === old.jobId && existing?.candidateId === old.candidateId
      && existing?.status === 'Selected' && !existing?.appliedAt && !existing?.appliedResumeId;
    if (decision === 'Approved' && existingApplication.exists() && !unreviewedDemo) throw new Error('An application already exists for this candidate and job.');
    const timestamp = new Date().toISOString();
    const next = { ...fresh, reviewedDecision: decision, reviewReason: reviewReason.trim(), reviewedAt: timestamp, reviewedBy: user.email, ...(decision === 'Approved' ? { applicationId } : {}) };
    tx.set(ref, next);
    const catalog = j.data() as CatalogJob;
    const signalId = `${catalog.family}_${catalog.role}`.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 120);
    tx.set(doc(db, 'matchReviewSignals', signalId), {
      family: catalog.family, role: catalog.role, updatedAt: timestamp, lastDecision: decision,
      lastReason: reviewReason.trim(), lastScore: fresh.score,
      ...(decision === 'Approved' ? { approvedCount: increment(1) } : { rejectedCount: increment(1) }),
    }, { merge: true });
    if (decision === 'Approved') {
      tx.set(doc(db, 'candidateCatalogAccess', String(c.data().email), 'jobs', old.jobId), { candidateId: old.candidateId });
      // Application data only. The JD is joined from catalogJobs when read.
      tx.set(doc(db, 'jobs', applicationId), { id: applicationId, catalogId: old.jobId, candidateId: old.candidateId,
        status: 'Selected', matchScore: fresh.score, appliedAt: null, appliedResumeId: null, discoveredAt: timestamp, createdAt: timestamp, updatedAt: timestamp });
      tx.set(doc(db, 'events', crypto.randomUUID()), { jobId: applicationId, candidateId: old.candidateId, eventType: 'match_approved', title: 'Candidate assigned', detail: reviewReason.trim() || `Taxonomy family: ${catalog.family}`, createdAt: timestamp });
    }
    tx.set(doc(db, 'logs', crypto.randomUUID()), { actorEmail: user.email, action: `match.${decision.toLowerCase()}`, entityType: 'match', entityId: matchId, details: { reason: reviewReason, score: fresh.score }, createdAt: timestamp });
    return decision === 'Approved' ? applicationId : null;
  });
}

export async function hydrateJob<T extends { catalogId?: string }>(job: T) {
  if (!job.catalogId) return job;
  const source = await getDoc(doc(db, 'catalogJobs', job.catalogId));
  if (!source.exists()) throw new Error('Shared job description is missing.');
  const catalog = source.data() as CatalogJob;
  const { id: catalogId, status, createdAt, updatedAt, ...description } = catalog;
  return { ...job, ...description,
    targetRole: catalog.role, targetLocation: catalog.location,
    salary: catalog.salary || (catalog.salaryMax == null ? 'Not listed' : `Up to ${catalog.currency} ${catalog.salaryMax.toLocaleString()}`) };
}
