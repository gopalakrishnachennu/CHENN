import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, getDocs, collection, type Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { preferences } from '../lib/matching';

const holder = vi.hoisted(() => ({ database: null as unknown as Firestore }));
vi.mock('../lib/firebase', () => ({ firebaseApp: {} }));
vi.mock('firebase/storage', async importOriginal => ({ ...await importOriginal<typeof import('firebase/storage')>(), getStorage: () => ({}) }));
vi.mock('firebase/firestore', async importOriginal => ({ ...await importOriginal<typeof import('firebase/firestore')>(), getFirestore: () => holder.database }));
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Matching transactions', () => {
  let environment: RulesTestEnvironment;
  let store: typeof import('../lib/matching-store');
  const user = { email: 'gopalakrishnachennu@gmail.com', emailVerified: true } as User;
  const input = { salary: 'USD 120,000–160,000/year', sourceUrl: 'https://example.com/jobs/1', company: 'Acme', title: 'Engineer', family: 'DevOps', location: 'Remote', workType: 'Remote', jdText: 'AWS required', mandatorySkills: ['AWS'], role: 'Engineer', seniority: 'Senior', authorization: 'US authorized', minimumYears: 2, expiresAt: '2099-01-01' };
  beforeAll(async () => {
    environment = await initializeTestEnvironment({ projectId: 'resumeos-matching-gate', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
    // Rules testing returns the compat facade; modular Firestore APIs unwrap it.
    holder.database = environment.authenticatedContext('admin', { email: user.email! }).firestore() as unknown as Firestore;
    store = await import('../lib/matching-store');
  });
  beforeEach(async () => {
    await environment.clearFirestore();
    await setDoc(doc(holder.database, 'families', 'devops'), { name: 'DevOps', active: true });
    for (const id of ['a', 'b']) await setDoc(doc(holder.database, 'candidates', id), { id, name: id, firstName: id, lastName: 'Test', phone: '555-0100', location: 'Remote', family: 'DevOps', email: `${id}@example.com`, portalEnabled: true, status: 'Active', skills: [{ name: 'AWS', source: 'Profile', evidence: 'Verified work' }], matchPreferences: preferences({ targetRoles: ['Engineer'], locations: ['Remote'], workTypes: ['Remote'], authorizations: ['US authorized'], seniorities: ['Senior'], yearsExperience: 5 }) });
  });
  afterAll(async () => { await environment.cleanup(); });
  it('saves raw jobs before analysis and only matches after family review', async () => {
    const raw = { ...input, family: '', workType: '' };
    expect(await store.importCatalog(user, [raw], true)).toEqual({ added: 1, duplicates: 0 });
    const saved = (await store.readMatchingData(user)).jobs[0];
    expect(saved.analysisStatus).toBe('Pending');
    expect(saved.jdText).toBe(input.jdText);
    expect(saved.jdProfile).toBeUndefined();
    expect((await getDocs(collection(holder.database, 'jdProfiles'))).size).toBe(0);
    expect(await store.runMatching(user)).toBe(0);
    await store.saveCatalogJob(user, { ...saved, ...input, familyConfidence: 100 });
    expect((await store.readMatchingData(user)).jobs[0].analysisStatus).toBe('Ready');
    expect(await store.runMatching(user)).toBe(2);
    expect(await store.importCatalog(user, [raw], true)).toEqual({ added: 0, duplicates: 1 });
  });
  it('loads 50 shared jobs without generating matches, profiles or expiring records on navigation', async () => {
    await Promise.all(Array.from({ length: 50 }, (_, i) => setDoc(doc(holder.database, 'catalogJobs', `read-test-${i}`), { ...input, id: `read-test-${i}`, status: 'Open', expiresAt: '2000-01-01' })));
    const first = await store.readMatchingData(user);
    const again = await store.readMatchingData(user);
    expect(first.jobs).toHaveLength(50);
    expect(again).toEqual(first);
    expect(first.matches).toEqual([]);
    expect(first.jobs.every(job => job.status === 'Open')).toBe(true);
    expect((await getDocs(collection(holder.database, 'jdProfiles'))).size).toBe(0);
    expect((await getDocs(collection(holder.database, 'jobMatches'))).size).toBe(0);
  });
  it('stores a shared JD once and creates independent candidate applications', async () => {
    expect(await store.importCatalog(user, [input, input])).toEqual({ added: 1, duplicates: 1 });
    expect(await store.runMatching(user)).toBe(2);
    const data = await store.readMatchingData(user); expect(data.jobs).toHaveLength(1); expect(data.matches).toHaveLength(2);
    for (const match of data.matches) {
      expect(match.decision).toBe('Selected'); await store.decideMatch(user, match.id, 'Approved', '');
      const raw = (await getDoc(doc(holder.database, 'jobs', match.id))).data()!;
      expect(raw.jdText).toBeUndefined(); expect((await store.hydrateJob(raw)).jdText).toBe(input.jdText);
      await expect(store.decideMatch(user, match.id, 'Approved', '')).rejects.toThrow('already has an application');
    }
    expect((await getDocs(collection(holder.database, 'jobs'))).size).toBe(2);
    await store.runMatching(user); expect((await store.readMatchingData(user)).matches.every(m => m.applicationId)).toBe(true);
  });
  it('validates all import rows before writing any job', async () => {
    await expect(store.importCatalog(user, [input, { ...input, family: 'Invalid' }])).rejects.toThrow('Row 2');
    expect((await getDocs(collection(holder.database, 'catalogJobs'))).size).toBe(0);
  });
  it('adopts an unreviewed demo row only after eligibility review and keeps the shared JD authoritative', async () => {
    const candidate = (await getDoc(doc(holder.database, 'candidates', 'a'))).data()!;
    await setDoc(doc(holder.database, 'candidates', 'demo-candidate-01'), { ...candidate, id: 'demo-candidate-01' });
    const { normalizeJob } = await import('../lib/matching');
    await setDoc(doc(holder.database, 'catalogJobs', 'demo-job-01'), { ...normalizeJob(input), id: 'demo-job-01' });
    await store.runMatching(user);
    const id = 'demo-job-01_demo-candidate-01';
    await setDoc(doc(holder.database, 'jobs', id), { id, catalogId: 'demo-job-01', candidateId: 'demo-candidate-01', jdText: 'Old duplicated text', status: 'Selected', appliedAt: null, appliedResumeId: null });
    const raw = (await getDoc(doc(holder.database, 'jobs', id))).data()!;
    expect((await store.hydrateJob(raw)).jdText).toBe(input.jdText);
    expect(await store.decideMatch(user, id, 'Approved', 'Reviewed demo eligibility')).toBe(id);
    expect((await getDocs(collection(holder.database, 'jobs'))).size).toBe(1);
    expect((await getDoc(doc(holder.database, 'jobs', id))).data()?.jdText).toBeUndefined();
    await expect(store.decideMatch(user, id, 'Approved', '')).rejects.toThrow('already has an application');
  });
  it('reserves paid operations once, reuses completed results and allows explicit retry after failure', async () => {
    const { cachedAIRequest } = await import('../lib/ai-request-store');
    let release!: () => void; let started!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const entered = new Promise<void>(resolve => { started = resolve; });
    const producer = vi.fn(async () => { started(); await pending; return { resumeId: 'r1' }; });
    const first = cachedAIRequest('test-lock', producer);
    await entered;
    await expect(cachedAIRequest('test-lock', producer)).rejects.toThrow('already running');
    release(); expect(await first).toEqual({ resumeId: 'r1' });
    expect(await cachedAIRequest('test-lock', producer)).toEqual({ resumeId: 'r1' });
    expect(producer).toHaveBeenCalledTimes(1);
    await expect(cachedAIRequest('test-failure', async () => { throw new Error('Provider failed'); })).rejects.toThrow('Provider failed');
    expect(await cachedAIRequest('test-failure', async () => 'retried')).toBe('retried');
    const candidateDb = environment.authenticatedContext('candidate', { email: 'a@example.com' }).firestore() as unknown as Firestore;
    await expect(getDoc(doc(candidateDb, 'aiRequests', 'test-lock'))).rejects.toThrow();
    await expect(setDoc(doc(candidateDb, 'aiRequests', 'fake'), { status: 'ready' })).rejects.toThrow();
    await expect(setDoc(doc(candidateDb, 'resumeCounters', 'fake'), { version: 100 })).rejects.toThrow();
  });
  it('persists confirmed qualifications with audit provenance and blocks unconfirmed requests', async () => {
    const { runFirebaseAction } = await import('../lib/firebase-backend');
    const items = [{ kind: 'skill', name: 'Python', evidence: 'Candidate demonstrated Python scripts' }];
    await expect(runFirebaseAction(user, 'candidate.qualifications.confirm', { candidateId: 'a', items })).rejects.toThrow('Confirm');
    await runFirebaseAction(user, 'candidate.qualifications.confirm', { candidateId: 'a', items, confirmed: true });
    const record = (await getDoc(doc(holder.database, 'candidates', 'a'))).data()!;
    expect(record.skills.some((skill: { name: string }) => skill.name === 'Python')).toBe(true);
    expect(record.qualificationConfirmations[0].confirmedBy).toBe(user.email);
    expect((await getDocs(collection(holder.database, 'logs'))).size).toBe(1);
  });
  it('requires factual review before approving an AI resume', async () => {
    const { runFirebaseAction } = await import('../lib/firebase-backend');
    await setDoc(doc(holder.database, 'resumes', 'ai-draft'), { id: 'ai-draft', candidateId: 'a', jobId: 'application', aiMetadata: { factualReviewRequired: true }, validation: { passed: true } });
    await expect(runFirebaseAction(user, 'resume.approve', { id: 'ai-draft' })).rejects.toThrow('confirm factual accuracy');
    await setDoc(doc(holder.database, 'resumes', 'invalid-draft'), { id: 'invalid-draft', validation: { passed: false } });
    await expect(runFirebaseAction(user, 'resume.approve', { id: 'invalid-draft', factualReviewConfirmed: true })).rejects.toThrow('failed validation');
  });
  it('runs the full AI workflow: one JD call, per-candidate writing, cached reuse, and approval', async () => {
    const { runFirebaseAction } = await import('../lib/firebase-backend');
    const { createJDProfile } = await import('../lib/jd-profile');
    const jdProfile = createJDProfile(input, 'test').jdProfile;
    const originalFetch = globalThis.fetch;
    let analysisCalls = 0; let writingCalls = 0;
    vi.stubGlobal('window', { localStorage: { getItem: () => 'test-key-not-a-secret' } });
    vi.stubGlobal('fetch', vi.fn(async (...args: Parameters<typeof fetch>) => {
      if (String(args[0]) !== 'https://api.openai.com/v1/responses') return originalFetch(...args);
      const body = JSON.parse(String(args[1]?.body));
      let value: unknown;
      if (body.text.format.name === 'jd_profile') { analysisCalls++; value = jdProfile; }
      else {
        writingCalls++; const data = JSON.parse(body.input);
        expect(data.jdText).toBeUndefined(); expect(data.JD_PROFILE).toBeDefined();
        const source = data.VERIFIED_EVIDENCE.find((e: { id: string }) => e.id === 'experience:0:0');
        const claim = { text: source.text, sourceRefs: [source.id], keywords: ['AWS'] };
        value = { summary: [claim], skillCategories: [{ category: 'Cloud', skills: ['AWS'] }], experience: [{ experienceIndex: 0, bullets: [claim] }], gaps: [] };
      }
      return new Response(JSON.stringify({ id: 'resp_integration', status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }], usage: { input_tokens: 120, output_tokens: 80 } }));
    }));
    try {
      for (const id of ['a', 'b']) await setDoc(doc(holder.database, 'candidates', id), { updatedAt: '2026-09-09', career: { experience: [{ company: 'Actual employer', title: 'Engineer', location: 'Remote', start: '2020-01', end: '', current: true, responsibilities: 'Built AWS infrastructure for internal services using documented workflows and reusable configuration, helping the engineering team maintain consistent deployment processes and reliable changes.', achievements: '', technologies: 'AWS' }], education: [], certifications: [], projects: [] } }, { merge: true });
      await store.importCatalog(user, [input]);
      await store.runMatching(user);
      const data = await store.readMatchingData(user);
      for (const match of data.matches) await store.decideMatch(user, match.id, 'Approved', '');
      const first = await runFirebaseAction(user, 'resume.generate', { jobId: data.matches[0].id });
      await setDoc(doc(holder.database, 'candidates', data.matches[0].candidateId), { updatedAt: '2026-09-10' }, { merge: true });
      const again = await runFirebaseAction(user, 'resume.generate', { jobId: data.matches[0].id });
      expect((first.resume as { id: string }).id).toBe((again.resume as { id: string }).id);
      await runFirebaseAction(user, 'resume.generate', { jobId: data.matches[1].id });
      expect(analysisCalls).toBe(1); expect(writingCalls).toBe(2);
      await store.readMatchingData(user); expect(analysisCalls).toBe(1);
      const id = (first.resume as { id: string }).id;
      expect((await getDoc(doc(holder.database, 'resumes', id))).data()?.candidateVisible).toBe(false);
      await runFirebaseAction(user, 'resume.approve', { id, factualReviewConfirmed: true });
      expect((await getDoc(doc(holder.database, 'resumes', id))).data()).toMatchObject({ status: 'Approved', candidateVisible: true });
    } finally { vi.unstubAllGlobals(); }
  });
  it('reuses one profile across candidates and replaces the reference after JD edits', async () => {
    await store.importCatalog(user, [input]);
    const first = (await store.readMatchingData(user)).jobs[0];
    await store.runMatching(user);
    expect((await getDocs(collection(holder.database, 'jdProfiles'))).size).toBe(1);
    expect(await store.hydrateJob({ catalogId: first.id })).toMatchObject({ jdHash: first.jdHash });
    await store.saveCatalogJob(user, { ...first, jdText: input.jdText + '\nPython preferred.' });
    const next = (await store.readMatchingData(user)).jobs[0];
    expect(next.jdHash).not.toBe(first.jdHash);
    expect(next.jdProfile?.preferred_skills).toContain('Python');
    expect((await getDocs(collection(holder.database, 'jdProfiles'))).size).toBe(2);
  });
  it('deduplicates simultaneous cache requests and denies candidate cache access', async () => {
    const values = await Promise.all([store.cachedJDProfile(user, input), store.cachedJDProfile(user, input)]);
    expect(values[0]).toEqual(values[1]);
    expect((await getDocs(collection(holder.database, 'jdProfiles'))).size).toBe(1);
    const candidateDb = environment.authenticatedContext('candidate', { email: 'a@example.com' }).firestore() as unknown as Firestore;
    await expect(getDoc(doc(candidateDb, 'jdProfiles', values[0].jdHash))).rejects.toThrow();
    await expect(setDoc(doc(candidateDb, 'jdProfiles', 'fake'), { jdProfile: {} })).rejects.toThrow();
  });
  it('rechecks an expired or changed job at approval time', async () => {
    await store.importCatalog(user, [input]); await store.runMatching(user); const data = await store.readMatchingData(user);
    await setDoc(doc(holder.database, 'catalogJobs', data.jobs[0].id), { status: 'Closed' }, { merge: true });
    await expect(store.decideMatch(user, data.matches[0].id, 'Approved', 'Reviewed')).rejects.toThrow('blocked');
    expect((await getDocs(collection(holder.database, 'jobs'))).size).toBe(0);
  });
  it('prevents changing the identity of a shared job and rejects unverified admins', async () => {
    await store.importCatalog(user, [input]); const { jobs } = await store.readMatchingData(user);
    await expect(store.saveCatalogJob(user, { ...jobs[0], company: 'Different' })).rejects.toThrow('identify a shared job');
    await expect(store.importCatalog({ ...user, emailVerified: false } as User, [input])).rejects.toThrow('Verified administrator');
  });
});
