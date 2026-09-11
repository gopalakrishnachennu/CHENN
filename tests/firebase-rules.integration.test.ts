import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const runningEmulators = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST &&
  process.env.FIREBASE_STORAGE_EMULATOR_HOST,
);

describe.skipIf(!runningEmulators)('Firebase access boundaries', () => {
  let environment: RulesTestEnvironment;
  const projectId = 'resumeos-release-gate';
  const adminEmail = 'gopalakrishnachennu@gmail.com';
  const candidateEmail = 'candidate@example.com';

  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId,
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
      storage: { rules: readFileSync('storage.rules', 'utf8') },
    });
    await environment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore();
      await setDoc(doc(database, 'candidates', 'candidate-1'), {
        id: 'candidate-1',
        email: candidateEmail,
        portalEnabled: true,
        status: 'Active',
      });
      await setDoc(doc(database, 'candidates', 'candidate-2'), {
        id: 'candidate-2',
        email: 'other@example.com',
        portalEnabled: true,
        status: 'Active',
      });
      await setDoc(doc(database, 'jobs', 'job-1'), {
        id: 'job-1',
        candidateId: 'candidate-1',
      });
      await setDoc(doc(database, 'jobs', 'job-2'), {
        id: 'job-2',
        candidateId: 'candidate-2',
      });
      await setDoc(doc(database, 'resumes', 'resume-visible'), {
        id: 'resume-visible',
        candidateId: 'candidate-1',
        candidateVisible: true,
      });
      await setDoc(doc(database, 'resumes', 'resume-hidden'), {
        id: 'resume-hidden',
        candidateId: 'candidate-1',
        candidateVisible: false,
      });
      await setDoc(doc(database, 'settings', 'platform'), {
        portalName: 'ResumeOS',
      });
      await setDoc(doc(database, 'catalogJobs', 'shared-job'), { id: 'shared-job', jdText: 'Shared JD' });
      await setDoc(doc(database, 'catalogJobs', 'unassigned-job'), { id: 'unassigned-job' });
      await setDoc(doc(database, 'candidateCatalogAccess', candidateEmail, 'jobs', 'shared-job'), { candidateId: 'candidate-1' });
      await setDoc(doc(database, 'jobMatches', 'match-1'), { candidateId: 'candidate-1', score: 90 });
    });
  });

  afterAll(async () => environment.cleanup());

  it('gives the administrator full document control', async () => {
    const database = environment
      .authenticatedContext('admin', { email: adminEmail })
      .firestore();
    await assertSucceeds(
      setDoc(doc(database, 'candidates', 'candidate-3'), {
        email: 'new@example.com',
      }),
    );
    await assertSucceeds(getDoc(doc(database, 'logs', 'missing')));
  });

  it('keeps a candidate read-only and scoped to their own records', async () => {
    const database = environment
      .authenticatedContext('candidate', { email: candidateEmail })
      .firestore();
    await assertSucceeds(getDoc(doc(database, 'candidates', 'candidate-1')));
    await assertFails(getDoc(doc(database, 'candidates', 'candidate-2')));
    await assertSucceeds(getDoc(doc(database, 'jobs', 'job-1')));
    await assertFails(getDoc(doc(database, 'jobs', 'job-2')));
    await assertFails(
      setDoc(doc(database, 'jobs', 'job-new'), { candidateId: 'candidate-1' }),
    );
  });

  it('publishes only candidate-visible resume versions', async () => {
    const database = environment
      .authenticatedContext('candidate', { email: candidateEmail })
      .firestore();
    await assertSucceeds(getDoc(doc(database, 'resumes', 'resume-visible')));
    await assertFails(getDoc(doc(database, 'resumes', 'resume-hidden')));
  });

  it('allows only assigned shared JDs and prevents candidates changing match decisions', async () => {
    const database = environment.authenticatedContext('candidate', { email: candidateEmail }).firestore();
    await assertSucceeds(getDoc(doc(database, 'catalogJobs', 'shared-job')));
    await assertFails(getDoc(doc(database, 'catalogJobs', 'unassigned-job')));
    await assertSucceeds(getDoc(doc(database, 'jobMatches', 'match-1')));
    await assertFails(setDoc(doc(database, 'jobMatches', 'match-1'), { candidateId: 'candidate-1', score: 100 }));
    await assertFails(setDoc(doc(database, 'candidateCatalogAccess', candidateEmail, 'jobs', 'unassigned-job'), { candidateId: 'candidate-1' }));
    const other = environment.authenticatedContext('other', { email: 'other@example.com' }).firestore();
    await assertFails(getDoc(doc(other, 'jobMatches', 'match-1')));
    await assertFails(getDoc(doc(other, 'catalogJobs', 'shared-job')));
  });

  it('blocks unauthenticated portal data', async () => {
    const database = environment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(database, 'settings', 'platform')));
    await assertFails(getDoc(doc(database, 'candidates', 'candidate-1')));
  });

  it('restricts usage and prompt history to administrators; published history is immutable', async () => {
    const admin = environment.authenticatedContext('admin', { email: adminEmail }).firestore();
    const candidate = environment.authenticatedContext('candidate', { email: candidateEmail }).firestore();
    const anonymous = environment.unauthenticatedContext().firestore();
    for (const path of ['llmUsage/test-request', 'prompts/resume-generation/versions/1']) {
      await assertSucceeds(setDoc(doc(admin, path), { status: 'completed', version: 1 }));
      await assertSucceeds(getDoc(doc(admin, path)));
      await assertFails(getDoc(doc(candidate, path)));
      await assertFails(getDoc(doc(anonymous, path)));
      await assertFails(setDoc(doc(candidate, path), { usage: 0 }));
    }
    await assertFails(setDoc(doc(admin, 'prompts/resume-generation/versions/1'), { version: 99 }));
  });

  it('enforces candidate file metadata and read scope', async () => {
    const adminStorage = environment
      .authenticatedContext('admin', { email: adminEmail })
      .storage();
    const candidateStorage = environment
      .authenticatedContext('candidate', { email: candidateEmail })
      .storage();
    const otherStorage = environment
      .authenticatedContext('other', { email: 'other@example.com' })
      .storage();
    const path = 'candidate/candidate-1/base/file/resume.txt';
    await assertSucceeds(
      uploadBytes(
        ref(adminStorage, path),
        new TextEncoder().encode('verified resume'),
        {
          contentType: 'text/plain',
          customMetadata: { candidateId: 'candidate-1', candidateEmail },
        },
      ),
    );
    await assertSucceeds(getBytes(ref(candidateStorage, path)));
    await assertFails(getBytes(ref(otherStorage, path)));
    await assertFails(
      uploadBytes(
        ref(candidateStorage, 'candidate/candidate-1/base/file/forbidden.txt'),
        new Uint8Array([1]),
        {
          customMetadata: { candidateId: 'candidate-1', candidateEmail },
        },
      ),
    );
    expect(true).toBe(true);
  });
});
