import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, getDocs, collection, type Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { preferences } from '../lib/matching';

const holder = vi.hoisted(() => ({ database: null as unknown as Firestore }));
vi.mock('../lib/firebase', () => ({ firebaseApp: {} }));
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
