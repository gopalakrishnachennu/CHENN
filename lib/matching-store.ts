import { collection, doc, getDoc, getDocs, getFirestore, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { firebaseApp } from './firebase';
import { ADMIN_EMAIL } from './constants';
import { catalogId, evaluateMatch, normalizeJob, preferences, type CatalogJob, type JobMatch } from './matching';
import type { Candidate } from './types';

const db = getFirestore(firebaseApp, 'chenn');
async function readMatchingDataRaw() {
  const [jobs, matches] = await Promise.all([getDocs(collection(db, 'catalogJobs')), getDocs(collection(db, 'jobMatches'))]);
  return { jobs: jobs.docs.map(d => ({ ...d.data(), id: d.id }) as CatalogJob), matches: matches.docs.map(d => ({ ...d.data(), id: d.id }) as JobMatch) };
}
async function expireCatalogJobs() {
  const now = Date.now();
  const snapshot = await getDocs(collection(db, 'catalogJobs'));
  await Promise.all(snapshot.docs.filter(d => d.data().status === 'Open' && Date.parse(String(d.data().expiresAt)) <= now).map(d => updateDoc(d.ref, { status: 'Closed', updatedAt: new Date().toISOString() })));
}
async function recalculateMatches() {
  const [data, candidateDocs] = await Promise.all([readMatchingDataRaw(), getDocs(collection(db, 'candidates'))]);
  const candidates = candidateDocs.docs.map(d => ({ ...d.data(), id: d.id }) as Candidate);
  let count = 0;
  for (const job of data.jobs) for (const candidate of candidates) {
    await runTransaction(db, async tx => {
      const ref = doc(db, 'jobMatches', `${job.id}_${candidate.id}`);
      const [previous, freshJob, freshCandidate] = await Promise.all([tx.get(ref), tx.get(doc(db, 'catalogJobs', job.id)), tx.get(doc(db, 'candidates', candidate.id))]);
      if (!freshJob.exists() || !freshCandidate.exists()) return;
      const match = evaluateMatch(freshJob.data() as CatalogJob, freshCandidate.data() as Candidate);
      tx.set(ref, { ...previous.data(), ...match });
    }); count++;
  }
  return count;
}
export async function readMatchingData(user: User) {
  requireAdmin(user);
  await expireCatalogJobs();
  await recalculateMatches();
  return readMatchingDataRaw();
}
function requireAdmin(user: User) {
  if (!user.emailVerified || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) throw new Error('Verified administrator access required.');
}
export async function importCatalog(user: User, rows: Record<string, unknown>[]) {
  requireAdmin(user);
  if (!rows.length || rows.length > 100) throw new Error('Import between 1 and 100 jobs.');
  const families = (await getDocs(collection(db, 'families'))).docs.filter(d => d.data().active).map(d => d.data().name);
  const normalized = await Promise.all(rows.map(async (row, index) => {
    try { const job = normalizeJob(row); if (!families.includes(job.family)) throw new Error('Choose an active family.'); return { ...job, id: await catalogId(job) }; }
    catch (error) { throw new Error(`Row ${index + 1}: ${(error as Error).message}`); }
  }));
  let added = 0;
  for (const job of normalized) {
    const created = await runTransaction(db, async tx => {
      const ref = doc(db, 'catalogJobs', job.id); const existing = await tx.get(ref);
      if (existing.exists()) return false;
      tx.set(ref, job); return true;
    });
    if (created) added++;
  }
  return { added, duplicates: rows.length - added };
}
export async function saveCatalogJob(user: User, job: CatalogJob) {
  requireAdmin(user); const normalized = normalizeJob(job);
  const current = await getDoc(doc(db, 'catalogJobs', job.id));
  if (!current.exists()) throw new Error('Shared job no longer exists.');
  const allowed = (await getDocs(collection(db, 'families'))).docs.filter(d => d.data().active).map(d => d.data().name);
  if (!allowed.includes(normalized.family)) throw new Error('Choose an active family.');
  // Identity fields define deduplication. Keep them stable for existing applications.
  if (await catalogId(normalized) !== job.id) throw new Error('Company, title and location identify a shared job. Import a new vacancy to change these fields.');
  await setDoc(doc(db, 'catalogJobs', job.id), { ...normalized, id: job.id });
  await runMatching(user);
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
  return recalculateMatches();
}
export async function decideMatch(user: User, matchId: string, decision: 'Approved' | 'Rejected', reviewReason: string) {
  requireAdmin(user);
  return runTransaction(db, async tx => {
    const ref = doc(db, 'jobMatches', matchId); const snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw new Error('Match no longer exists.');
    const old = snapshot.data() as JobMatch;
    const [j, c] = await Promise.all([tx.get(doc(db, 'catalogJobs', old.jobId)), tx.get(doc(db, 'candidates', old.candidateId))]);
    if (!j.exists() || !c.exists()) throw new Error('Job or candidate no longer exists.');
    const fresh = evaluateMatch(j.data() as CatalogJob, c.data() as Candidate);
    if (old.applicationId) throw new Error('This match already has an application. Manage it under Jobs & JDs.');
    if (decision === 'Approved' && (fresh.eligibility === 'Ineligible' || fresh.score < 70)) throw new Error('This match is blocked. Correct the underlying requirements before approval.');
    if (fresh.decision !== 'Selected' && !reviewReason.trim()) throw new Error('Enter a reason for your review decision.');
    const applicationId = fresh.id;
    const existingApplication = await tx.get(doc(db, 'jobs', applicationId));
    if (decision === 'Approved' && existingApplication.exists()) throw new Error('An application already exists for this candidate and job.');
    const timestamp = new Date().toISOString();
    const next = { ...fresh, reviewedDecision: decision, reviewReason: reviewReason.trim(), reviewedAt: timestamp, reviewedBy: user.email, ...(decision === 'Approved' ? { applicationId } : {}) };
    tx.set(ref, next);
    if (decision === 'Approved') {
      tx.set(doc(db, 'candidateCatalogAccess', String(c.data().email), 'jobs', old.jobId), { candidateId: old.candidateId });
      // Application data only. The JD is joined from catalogJobs when read.
      tx.set(doc(db, 'jobs', applicationId), { id: applicationId, catalogId: old.jobId, candidateId: old.candidateId,
        status: 'Selected', matchScore: fresh.score, appliedAt: null, appliedResumeId: null, discoveredAt: timestamp, createdAt: timestamp, updatedAt: timestamp });
      tx.set(doc(db, 'events', crypto.randomUUID()), { jobId: applicationId, candidateId: old.candidateId, eventType: 'match_approved', title: 'Match approved', detail: reviewReason.trim() || `Matched at ${fresh.score}%`, createdAt: timestamp });
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
  return { ...catalog, targetRole: catalog.role, targetLocation: catalog.location,
    salary: catalog.salaryMax == null ? 'Not listed' : `Up to ${catalog.currency} ${catalog.salaryMax.toLocaleString()}`, ...job };
}
