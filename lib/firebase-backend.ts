import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  runTransaction,
  type QueryConstraint,
} from 'firebase/firestore';
import { deleteObject, getStorage, ref } from 'firebase/storage';
import { ADMIN_EMAIL } from './constants';
import { DEFAULT_SETTINGS } from './default-settings';
import { firebaseApp } from './firebase';
import { evaluateReleaseHealth } from './release-health';
import { autoAssignFamilyMatches, hydrateJob, ensureCatalogProfile, cachedJDProfile } from './matching-store';
import { adminAIKey } from './ai-client';
import { writeResumeWithLLM, validateAIResumeEdit, candidateGenerationFacts, RESUME_PROMPT_VERSION } from './ai-resume';
import { cachedAIRequest } from './ai-request-store';
import { careerSchema, emptyCareer } from './career';
import {
  careerEvidence,
  deriveCandidateSkills,
  groundedResumeContent,
  validateGrounding,
} from './evidence';
import { provisionGmail } from './gmail-service';
import { candidateRequiredFields, careerRequiredFields, resumeGenerationRequiredFields } from './requirements';
import { evaluateMatch, preferences, type CatalogJob } from './matching';
import {
  buildSkillPlan,
  calculateMatch,
  extractSkillRequirements,
} from './server/policy';
import type {
  Announcement,
  AppState,
  ApplicationEvent,
  ApplicationStatus,
  AuditLog,
  Candidate,
  CandidateSkill,
  Evaluation,
  Job,
  JobFamily,
  PlatformSettings,
  Prompt,
  ResumeContent,
  ResumeVersion,
  OnboardingInvite,
  OnboardingSubmission,
} from './types';

export type FirebaseActionResult = {
  ok: boolean;
  message?: string;
  [key: string]: unknown;
};

const firebaseDb = getFirestore(firebaseApp, 'chenn');
const firebaseStorage = getStorage(firebaseApp);
const openAIKeyName = 'resumeos.openai.browser-key';
const openAIMetadataName = 'resumeos.openai.browser-metadata';

function now() {
  return new Date().toISOString();
}

function isAdmin(user: User) {
  return user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

function requireAdmin(user: User) {
  if (!isAdmin(user)) throw new Error('Administrator access is required.');
}

function required(payload: Record<string, unknown>, key: string) {
  const value = typeof payload[key] === 'string' ? payload[key].trim() : '';
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function words(value: unknown) {
  if (Array.isArray(value))
    return value
      .map(String)
      .map((item) => item.trim())
      .filter(Boolean);
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeHttpUrl(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  try {
    const parsed = new URL(text);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    return parsed.toString();
  } catch {
    throw new Error('Job URL must be a complete http:// or https:// address.');
  }
}

async function listDocuments<T>(
  name: string,
  constraints: QueryConstraint[] = [],
) {
  const source = constraints.length
    ? query(collection(firebaseDb, name), ...constraints)
    : collection(firebaseDb, name);
  const snapshot = await getDocs(source);
  return snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as T);
}

function sortNewest<T extends { createdAt?: string; updatedAt?: string }>(
  items: T[],
) {
  return items.sort((a, b) =>
    String(b.updatedAt ?? b.createdAt ?? '').localeCompare(
      String(a.updatedAt ?? a.createdAt ?? ''),
    ),
  );
}

function candidateShape(
  input: Omit<Candidate, 'name' | 'initials'>,
): Candidate {
  const name = `${input.firstName} ${input.lastName}`.trim();
  return {
    ...input,
    name,
    initials:
      `${input.firstName[0] ?? ''}${input.lastName[0] ?? ''}`.toUpperCase(),
  };
}

function browserCredential(): AppState['credential'] {
  if (typeof window === 'undefined') return { connected: false };
  const key = window.localStorage.getItem(openAIKeyName);
  if (!key) return { connected: false };
  try {
    const metadata = JSON.parse(
      window.localStorage.getItem(openAIMetadataName) ?? '{}',
    ) as {
      lastFour?: string;
      updatedAt?: string;
    };
    return { connected: true, ...metadata };
  } catch {
    return { connected: true, lastFour: key.slice(-4) };
  }
}

async function audit(
  actorEmail: string,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {},
) {
  const id = crypto.randomUUID();
  const entry: AuditLog = {
    id,
    actorEmail,
    action,
    entityType,
    entityId,
    details,
    createdAt: now(),
  };
  await setDoc(doc(firebaseDb, 'logs', id), entry);
}

function seedResumeContent(
  candidate: Candidate,
  headline: string,
): ResumeContent {
  return {
    name: candidate.name,
    headline,
    contact: [candidate.email, candidate.phone, candidate.location]
      .filter(Boolean)
      .join(' · '),
    summary: candidate.summary,
    skills: candidate.skills
      .filter((skill) => skill.source === 'Profile')
      .map((skill) => skill.name),
    experience: [],
    education: [],
  };
}

async function seedFirebase(user: User) {
  if (!isAdmin(user)) return;
  const existing = await getDocs(
    query(collection(firebaseDb, 'candidates'), limit(1)),
  );
  if (!existing.empty) return;

  const timestamp = now();
  const candidate = candidateShape({
    id: 'candidate-john',
    email: 'john.carter@email.com',
    firstName: 'John',
    lastName: 'Carter',
    phone: '+1 (206) 555-0188',
    headline: 'Senior DevOps & Platform Engineer',
    summary:
      'Cloud and platform engineer focused on reliable delivery, secure infrastructure, automation, and measurable operational improvements.',
    location: 'Seattle, WA',
    family: 'DevOps',
    status: 'Active',
    portalEnabled: true,
    skills: [
      ['AWS', 'Advanced', 8, 'Cloud infrastructure delivery and operations.'],
      ['Kubernetes', 'Advanced', 6, 'Production platform operations.'],
      ['Jenkins', 'Advanced', 5, 'CI/CD ownership.'],
      ['Python', 'Advanced', 7, 'Automation and internal tooling.'],
      ['Linux', 'Advanced', 9, 'Production Linux administration.'],
      ['Prometheus', 'Experienced', 4, 'Service and platform observability.'],
    ].map(([name, proficiency, years, evidence]) => ({
      id: crypto.randomUUID(),
      name: String(name),
      proficiency: String(proficiency),
      years: Number(years),
      evidence: String(evidence),
      source: 'Profile',
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const families: JobFamily[] = [
    {
      id: 'family-devops',
      name: 'DevOps',
      description: 'Cloud, platform, SRE and delivery engineering.',
      roles: [
        'DevOps Engineer',
        'Platform Engineer',
        'Site Reliability Engineer',
      ],
      skills: [
        'AWS',
        'Azure',
        'GCP',
        'Terraform',
        'Kubernetes',
        'Docker',
        'Jenkins',
        'GitHub Actions',
        'Prometheus',
        'Grafana',
        'Python',
        'Bash',
        'Linux',
        'Ansible',
        'Argo CD',
        'Helm',
        'CI/CD',
        'SRE',
        'Observability',
      ],
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'family-data',
      name: 'Data Engineering',
      description: 'Data platforms, pipelines and analytics infrastructure.',
      roles: ['Data Engineer', 'Analytics Engineer', 'Data Platform Engineer'],
      skills: [
        'SQL',
        'Python',
        'Snowflake',
        'Databricks',
        'Spark',
        'Kafka',
        'Airflow',
        'dbt',
        'AWS',
      ],
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'family-software',
      name: 'Software Engineering',
      description: 'Product, backend and full-stack software engineering.',
      roles: ['Software Engineer', 'Backend Engineer', 'Full Stack Engineer'],
      skills: [
        'JavaScript',
        'TypeScript',
        'React',
        'Node.js',
        'Java',
        'Go',
        'C#',
        '.NET',
        'SQL',
        'AWS',
      ],
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];

  const job: Job = {
    id: 'job-amazon',
    candidateId: candidate.id,
    company: 'Amazon',
    title: 'Senior DevOps Engineer',
    location: 'Seattle, WA',
    workType: 'Hybrid',
    salary: '$165K–$210K',
    source: 'LinkedIn',
    sourceUrl: 'https://www.amazon.jobs/',
    jdText:
      'Amazon is hiring a Senior DevOps Engineer to design and operate secure, highly available AWS infrastructure. Build infrastructure as code with Terraform, own Kubernetes reliability, and improve CI/CD automation with Jenkins. Experience with Prometheus and Python is preferred.',
    mandatorySkills: ['AWS', 'Terraform', 'Kubernetes', 'Jenkins'],
    preferredSkills: ['Prometheus', 'Python'],
    targetRole: 'Senior DevOps Engineer',
    targetLocation: 'Seattle Metro',
    family: 'DevOps',
    status: 'Applied',
    matchScore: 80,
    discoveredAt: timestamp,
    appliedAt: timestamp,
    appliedResumeId: 'resume-amazon-v1',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const plan = buildSkillPlan(
    candidate.skills,
    families[0],
    job.mandatorySkills,
    job.preferredSkills,
  );
  const resume: ResumeVersion & { candidateVisible: boolean } = {
    id: 'resume-amazon-v1',
    candidateId: candidate.id,
    jobId: job.id,
    parentId: null,
    version: 1,
    content: seedResumeContent(candidate, job.targetRole),
    skillPlan: plan,
    scores: {
      jdMatch: calculateMatch(plan),
      ats: 88,
      recruiterSafe: 100,
      evidence: 100,
    },
    template: 'Modern ATS',
    status: 'Approved',
    engine: 'evidence-safe',
    createdAt: timestamp,
    approvedAt: timestamp,
    candidateVisible: true,
  };
  const event: ApplicationEvent & { candidateId: string } = {
    id: 'event-amazon-applied',
    jobId: job.id,
    candidateId: candidate.id,
    eventType: 'status',
    title: 'Application submitted',
    detail: 'ResumeOS recorded the application as Applied.',
    createdAt: timestamp,
  };
  const announcement: Announcement = {
    id: 'announcement-welcome',
    title: 'Welcome to your career portal',
    message:
      'Track every job, status change, and approved resume here. Your portal is always read only.',
    active: true,
    createdAt: timestamp,
  };
  const prompt: Prompt = {
    id: 'prompt-base',
    name: 'Base JD-first generation',
    scope: 'Global',
    template:
      'Start with the complete JD. Use only candidate evidence. Never invent employers, dates, metrics, degrees, credentials, or skills.',
    version: 1,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const evaluation: Evaluation = {
    id: 'evaluation-seed',
    name: 'JD-first safety suite',
    status: 'Passed',
    score: 100,
    results: { factualSafety: 100, accessModel: 100, cases: 12 },
    createdAt: timestamp,
  };

  const batch = writeBatch(firebaseDb);
  batch.set(doc(firebaseDb, 'candidates', candidate.id), candidate);
  for (const family of families)
    batch.set(doc(firebaseDb, 'families', family.id), family);
  batch.set(doc(firebaseDb, 'jobs', job.id), job);
  batch.set(doc(firebaseDb, 'resumes', resume.id), resume);
  batch.set(doc(firebaseDb, 'events', event.id), event);
  batch.set(doc(firebaseDb, 'settings', 'platform'), DEFAULT_SETTINGS);
  batch.set(doc(firebaseDb, 'announcements', announcement.id), announcement);
  batch.set(doc(firebaseDb, 'prompts', prompt.id), prompt);
  batch.set(doc(firebaseDb, 'evaluations', evaluation.id), evaluation);
  batch.set(doc(firebaseDb, 'logs', 'workspace-seeded'), {
    id: 'workspace-seeded',
    actorEmail: user.email ?? ADMIN_EMAIL,
    action: 'workspace.seeded',
    entityType: 'system',
    entityId: 'resumeos',
    details: { candidates: 1, jobs: 1 },
    createdAt: timestamp,
  } satisfies AuditLog);
  await batch.commit();
}

async function mergedSettings() {
  const snapshot = await getDoc(doc(firebaseDb, 'settings', 'platform'));
  const stored = snapshot.exists()
    ? (snapshot.data() as Partial<PlatformSettings>)
    : {};
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    navigation: { ...DEFAULT_SETTINGS.navigation, ...stored.navigation },
    widgets: { ...DEFAULT_SETTINGS.widgets, ...stored.widgets },
    visibility: { ...DEFAULT_SETTINGS.visibility, ...stored.visibility },
    guardrails: { ...DEFAULT_SETTINGS.guardrails, ...stored.guardrails },
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...stored.notifications,
    },
    system: { ...DEFAULT_SETTINGS.system, ...stored.system },
    onboardingForm: { ...DEFAULT_SETTINGS.onboardingForm, ...stored.onboardingForm },
  } satisfies PlatformSettings;
}

export async function readFirebaseState(user: User): Promise<AppState> {
  const email = user.email?.toLowerCase();
  if (!email)
    throw new Error(
      'Your Google account does not expose a verified email address.',
    );
  const admin = isAdmin(user);
  if (admin) await seedFirebase(user);

  let candidates: Candidate[];
  if (admin) {
    candidates = (await listDocuments<Candidate>('candidates')).filter(
      (item) => item.status !== 'Archived',
    );
  } else {
    candidates = await listDocuments<Candidate>('candidates', [
      where('email', '==', email),
    ]);
    const candidate = candidates[0];
    if (
      !candidate ||
      !candidate.portalEnabled ||
      candidate.status === 'Archived'
    ) {
      throw new Error(
        'Your candidate portal is not active. Contact the ResumeOS administrator.',
      );
    }
  }
  candidates = sortNewest(candidates);
  const candidateId = admin ? undefined : candidates[0]?.id;

  const jobs = sortNewest(
    admin
      ? await listDocuments<Job>('jobs')
      : await listDocuments<Job>('jobs', [
          where('candidateId', '==', candidateId),
        ]),
  );
  const resumes = sortNewest(
    admin
      ? await listDocuments<ResumeVersion>('resumes')
      : await listDocuments<ResumeVersion>('resumes', [
          where('candidateId', '==', candidateId),
          where('candidateVisible', '==', true),
        ]),
  );
  const events = sortNewest(
    admin
      ? await listDocuments<ApplicationEvent>('events')
      : await listDocuments<ApplicationEvent>('events', [
          where('candidateId', '==', candidateId),
        ]),
  );
  const families = (await listDocuments<JobFamily>('families')).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const settings = await mergedSettings();
  const announcements = sortNewest(
    admin
      ? await listDocuments<Announcement>('announcements')
      : await listDocuments<Announcement>('announcements', [
          where('active', '==', true),
        ]),
  );

  const prompts = admin
    ? sortNewest(await listDocuments<Prompt>('prompts'))
    : [];
  const evaluations = admin
    ? sortNewest(await listDocuments<Evaluation>('evaluations')).slice(0, 20)
    : [];
  const logs = admin
    ? sortNewest(await listDocuments<AuditLog>('logs')).slice(0, 100)
    : [];
  const onboardingInvites = admin
    ? sortNewest(await listDocuments<OnboardingInvite>('onboardingInvites'))
    : [];
  const onboardingSubmissions = admin
    ? (await listDocuments<OnboardingSubmission>('onboardingSubmissions')).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    : [];

  return {
    role: admin ? 'admin' : 'candidate',
    user: { email, name: user.displayName ?? email, candidateId },
    candidates,
    jobs: await Promise.all(jobs.map(hydrateJob)),
    resumes,
    events,
    families,
    prompts,
    settings,
    announcements,
    evaluations,
    logs,
    onboardingInvites,
    onboardingSubmissions,
    credential: admin ? browserCredential() : { connected: false },
  };
}

async function familyByName(name: string) {
  const results = await listDocuments<JobFamily>('families', [
    where('name', '==', name),
  ]);
  return results.find((item) => item.active);
}

async function approvedResumeForJob(jobId: string) {
  const resumes = await listDocuments<ResumeVersion>('resumes', [
    where('jobId', '==', jobId),
  ]);
  return resumes
    .filter((item) => item.status === 'Approved')
    .sort((a, b) => b.version - a.version)[0];
}

async function removeDocuments(
  collectionName: string,
  field: string,
  value: string,
) {
  const snapshot = await getDocs(
    query(collection(firebaseDb, collectionName), where(field, '==', value)),
  );
  await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
  return snapshot.docs.map((item) => item.data());
}

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('');
}

export async function runFirebaseAction(
  user: User,
  action: string,
  payload: Record<string, unknown> = {},
): Promise<FirebaseActionResult> {
  requireAdmin(user);
  const actorEmail = user.email ?? ADMIN_EMAIL;
  const timestamp = now();

  if (action === 'onboarding.invite') {
    const id = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll('-', '')}`;
    const expiresAtMs = Date.now() + 7 * 86400000;
    const settings = await mergedSettings();
    const invite: OnboardingInvite = { id, status: 'Open', expiresAt: new Date(expiresAtMs).toISOString(), expiresAtMs, createdAt: timestamp, createdBy: actorEmail, template: settings.onboardingForm };
    await setDoc(doc(firebaseDb, 'onboardingInvites', id), invite);
    await audit(actorEmail, 'onboarding.invite_created', 'onboarding_invite', id);
    return { ok: true, id, link: `${typeof window !== 'undefined' ? window.location.origin : 'https://chenn.web.app'}#onboard/${id}`, message: 'Onboarding link created. Copy and send it to the candidate.' };
  }

  if (action === 'onboarding.approve' || action === 'onboarding.reject') {
    const id = required(payload, 'id');
    const snapshot = await getDoc(doc(firebaseDb, 'onboardingSubmissions', id));
    if (!snapshot.exists()) throw new Error('Onboarding submission not found.');
    const submission = snapshot.data() as OnboardingSubmission;
    if (submission.status !== 'Pending') throw new Error('This onboarding submission has already been reviewed.');
    if (action === 'onboarding.reject') {
      await updateDoc(doc(firebaseDb, 'onboardingSubmissions', id), { status: 'Rejected', reviewedAt: timestamp, reviewedBy: actorEmail, rejectionReason: String(payload.reason ?? '') });
      await audit(actorEmail, 'onboarding.rejected', 'onboarding_submission', id);
      return { ok: true, message: 'Onboarding submission rejected.' };
    }
    const family = submission.family === 'Custom / needs review' ? undefined : await familyByName(submission.family);
    if (!family && submission.family !== 'Custom / needs review') throw new Error('The submitted job family is not active. Update the family before approval.');
    const gaps = [...candidateRequiredFields({ ...submission, status: 'Active' }), ...careerRequiredFields(submission.career)];
    if (gaps.length) throw new Error(`Submission is incomplete: ${gaps.join(', ')}.`);
    const duplicate = await listDocuments<Candidate>('candidates', [where('email', '==', submission.email.toLowerCase())]);
    if (duplicate.length) throw new Error('A candidate with this email already exists.');
    const candidateId = crypto.randomUUID();
    const candidate = candidateShape({ id: candidateId, email: submission.email.toLowerCase(), firstName: submission.firstName, lastName: submission.lastName, phone: submission.phone, headline: submission.headline, summary: '', location: submission.location, family: family?.name ?? 'Custom / needs review', status: 'Active', portalEnabled: true, career: submission.career, skills: deriveCandidateSkills(submission.career, family?.skills ?? []), createdAt: timestamp, updatedAt: timestamp });
    await setDoc(doc(firebaseDb, 'candidates', candidateId), candidate);
    await updateDoc(doc(firebaseDb, 'onboardingSubmissions', id), { status: 'Approved', reviewedAt: timestamp, reviewedBy: actorEmail, candidateId });
    await updateDoc(doc(firebaseDb, 'onboardingInvites', submission.inviteId), { status: 'Used', submissionId: id });
    await audit(actorEmail, 'onboarding.approved', 'candidate', candidateId, { submissionId: id });
    await autoAssignFamilyMatches(user, { candidateId });
    return { ok: true, message: `${candidate.name} was onboarded.`, candidateId };
  }

  if (action === 'candidate.create') {
    const firstName = required(payload, 'firstName');
    const lastName = required(payload, 'lastName');
    const email = required(payload, 'email').toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email))
      throw new Error('Enter a valid candidate email.');
    const duplicate = await listDocuments<Candidate>('candidates', [
      where('email', '==', email),
    ]);
    if (duplicate.length)
      throw new Error('A candidate with that email already exists.');
    const id = crypto.randomUUID();
    const career = careerSchema.parse(payload.career ?? emptyCareer());
    const familyName = required(payload, 'family');
    const requiredCandidate = candidateRequiredFields({ ...payload, email, family: familyName });
    if (requiredCandidate.length) throw new Error(`Complete required candidate fields: ${requiredCandidate.join(', ')}.`);
    const family = familyName === 'Custom / needs review' ? undefined : await familyByName(familyName);
    if (!family && familyName !== 'Custom / needs review') throw new Error('Choose an active job family.');
    const candidate = candidateShape({
      id,
      email,
      firstName,
      lastName,
      phone: String(payload.phone ?? ''),
      headline: String(payload.headline ?? ''),
      summary: String(payload.summary ?? ''),
      career,
      location: String(payload.location ?? ''),
      family: familyName,
      status: 'Active',
      portalEnabled: payload.portalEnabled !== false,
      skills: deriveCandidateSkills(career, family?.skills ?? []),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await setDoc(doc(firebaseDb, 'candidates', id), candidate);
    await audit(actorEmail, 'candidate.created', 'candidate', id, {
      email,
      family: candidate.family,
    });
    await autoAssignFamilyMatches(user, { candidateId: id });
    return { ok: true, message: `${candidate.name} was added.`, id };
  }

  if (action === 'candidate.update') {
    const id = required(payload, 'id');
    const firstName = required(payload, 'firstName');
    const lastName = required(payload, 'lastName');
    const existing = await getDoc(doc(firebaseDb, 'candidates', id));
    if (!existing.exists()) throw new Error('Candidate not found.');
    const current = existing.data() as Candidate;
    if (String(payload.email).toLowerCase() !== current.email || payload.portalEnabled === false || payload.status === 'Archived') {
      await provisionGmail(user, (await mergedSettings()).gmailServiceUrl, id, current.email, false);
    }
    const career = careerSchema.parse(payload.career ?? current.career ?? emptyCareer());
    const familyName = required(payload, 'family');
    const requiredCandidate = candidateRequiredFields({ ...current, ...payload, email: String(payload.email ?? current.email), family: familyName });
    if (requiredCandidate.length) throw new Error(`Complete required candidate fields: ${requiredCandidate.join(', ')}.`);
    const family = familyName === 'Custom / needs review' ? undefined : await familyByName(familyName);
    if (!family && familyName !== 'Custom / needs review') throw new Error('Choose an active job family.');
    const candidate = candidateShape({
      ...current,
      id,
      email: required(payload, 'email').toLowerCase(),
      firstName,
      lastName,
      phone: String(payload.phone ?? ''),
      headline: String(payload.headline ?? ''),
      summary: String(payload.summary ?? ''),
      career,
      location: String(payload.location ?? ''),
      family: familyName,
      status: String(payload.status ?? current.status) as Candidate['status'],
      portalEnabled: payload.portalEnabled !== false,
      skills: deriveCandidateSkills(career, family?.skills ?? [], current.skills ?? []),
      createdAt: current.createdAt,
      updatedAt: timestamp,
    });
    await setDoc(doc(firebaseDb, 'candidates', id), candidate);
    await audit(actorEmail, 'candidate.updated', 'candidate', id, {
      email: candidate.email,
    });
    await autoAssignFamilyMatches(user, { candidateId: id });
    return { ok: true, message: `${candidate.name} was updated.` };
  }

  if (action === 'candidate.archive') {
    const id = required(payload, 'id');
    const candidate = (await getDoc(doc(firebaseDb, 'candidates', id))).data() as Candidate;
    await provisionGmail(user, (await mergedSettings()).gmailServiceUrl, id, candidate.email, false);
    await updateDoc(doc(firebaseDb, 'candidates', id), {
      status: 'Archived',
      portalEnabled: false,
      updatedAt: timestamp,
    });
    await audit(actorEmail, 'candidate.archived', 'candidate', id);
    return {
      ok: true,
      message: 'Candidate archived and portal access disabled.',
    };
  }

  if (action === 'candidate.delete') {
    const id = required(payload, 'id');
    const candidateSnapshot = await getDoc(doc(firebaseDb, 'candidates', id));
    if (candidateSnapshot.exists()) await provisionGmail(user, (await mergedSettings()).gmailServiceUrl, id, String(candidateSnapshot.data().email), false);
    if (!candidateSnapshot.exists()) throw new Error('Candidate not found.');
    const candidate = candidateSnapshot.data() as Candidate;
    const files = await removeDocuments('files', 'candidateId', id);
    await Promise.all(
      files.map(async (file) => {
        const storagePath = String(file.storagePath ?? '');
        if (storagePath)
          await deleteObject(ref(firebaseStorage, storagePath)).catch(
            () => undefined,
          );
      }),
    );
    await Promise.all([
      removeDocuments('jobs', 'candidateId', id),
      removeDocuments('resumes', 'candidateId', id),
      removeDocuments('events', 'candidateId', id),
      removeDocuments('jobMatches', 'candidateId', id),
    ]);
    await deleteDoc(doc(firebaseDb, 'candidates', id));
    await audit(actorEmail, 'candidate.deleted', 'candidate', id, {
      email: candidate.email,
    });
    return {
      ok: true,
      message: `${candidate.name} and all linked records were permanently deleted.`,
    };
  }

  if (action === 'candidate.skills.replace') {
    const candidateId = required(payload, 'candidateId');
    if (!Array.isArray(payload.skills))
      throw new Error('Candidate skills are required.');
    const skills: CandidateSkill[] = payload.skills.map((value) => {
      const item = value as Record<string, unknown>;
      return {
        id: String(item.id ?? crypto.randomUUID()),
        name: required(item, 'name'),
        proficiency: String(item.proficiency ?? 'Experienced'),
        years: Math.max(0, Math.min(60, Number(item.years ?? 0))),
        evidence: String(item.evidence ?? ''),
        source: 'Profile',
      };
    });
    await updateDoc(doc(firebaseDb, 'candidates', candidateId), {
      skills,
      updatedAt: timestamp,
    });
    await audit(
      actorEmail,
      'candidate.skills_replaced',
      'candidate',
      candidateId,
      { count: skills.length },
    );
    return { ok: true, message: `${skills.length} profile skills saved.` };
  }

  if (action === 'job.create' || action === 'job.update') {
    const updating = action === 'job.update';
    if (!updating)
      throw new Error('Candidate-specific JD creation is disabled. Add or import the JD from Job matching so it can be shared across eligible candidates.');
    const id = updating ? required(payload, 'id') : crypto.randomUUID();
    const existingSnapshot = updating
      ? await getDoc(doc(firebaseDb, 'jobs', id))
      : null;
    if (updating && !existingSnapshot?.exists())
      throw new Error('Job not found.');
    const existing = existingSnapshot?.data() as Job | undefined;
    if (existing?.catalogId) throw new Error('Edit this shared JD in Job matching. Change application status from the application list.');
    const candidateId = String(
      payload.candidateId ?? existing?.candidateId ?? '',
    );
    if (!candidateId) throw new Error('candidateId is required.');
    const candidateSnapshot = await getDoc(
      doc(firebaseDb, 'candidates', candidateId),
    );
    if (!candidateSnapshot.exists()) throw new Error('Candidate not found.');
    const candidate = candidateSnapshot.data() as Candidate;
    const candidateGaps = [...candidateRequiredFields(candidate), ...careerRequiredFields(candidate.career)];
    if (candidateGaps.length) throw new Error(`Candidate is not resume-ready: ${candidateGaps.join(', ')}.`);
    const familyName = required(payload, 'family');
    const family = await familyByName(familyName);
    if (!family) throw new Error('Choose an active job family.');
    const company = required(payload, 'company');
    const title = required(payload, 'title');
    const jdText = required(payload, 'jdText');
    const detected = extractSkillRequirements(jdText, family);
    const mandatorySkills = words(payload.mandatorySkills).length
      ? words(payload.mandatorySkills)
      : detected.mandatory;
    const preferredSkills = words(payload.preferredSkills).length
      ? words(payload.preferredSkills)
      : detected.preferred;
    const settings = await mergedSettings();
    const plan = buildSkillPlan(
      candidate.skills ?? [],
      family,
      mandatorySkills,
      preferredSkills,
      {
        allowFamilyContext:
          settings.guardrails.familyMatch &&
          candidate.family.toLowerCase() === familyName.toLowerCase(),
        allowSupportingContext: settings.guardrails.supportingContext,
      },
    );
    const status = String(
      payload.status ?? existing?.status ?? 'Selected',
    ) as ApplicationStatus;
    const applied = ['Applied', 'Interview', 'Rejected', 'Offer'].includes(
      status,
    );
    let appliedResumeId = existing?.appliedResumeId ?? null;
    if (applied && !appliedResumeId)
      appliedResumeId = (await approvedResumeForJob(id))?.id ?? null;
    const job: Job = {
      id,
      candidateId,
      company,
      title,
      location: String(payload.location ?? ''),
      workType: String(payload.workType ?? 'Not specified'),
      salary: required(payload, 'salary'),
      source: String(payload.source ?? 'Manual'),
      sourceUrl: safeHttpUrl(required(payload, 'sourceUrl')),
      jdText,
      mandatorySkills,
      preferredSkills,
      targetRole: String(payload.targetRole ?? title),
      targetLocation: String(payload.targetLocation ?? payload.location ?? ''),
      family: familyName,
      status,
      matchScore: calculateMatch(plan),
      discoveredAt: existing?.discoveredAt ?? timestamp,
      appliedAt: existing?.appliedAt ?? (applied ? timestamp : null),
      appliedResumeId,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    await setDoc(doc(firebaseDb, 'jobs', id), job);
    if (!updating) {
      const eventId = crypto.randomUUID();
      await setDoc(doc(firebaseDb, 'events', eventId), {
        id: eventId,
        jobId: id,
        candidateId,
        eventType: 'discovered',
        title: 'Job discovered',
        detail: `Added from ${job.source}`,
        createdAt: timestamp,
      });
    } else if (existing && existing.status !== status) {
      const eventId = crypto.randomUUID();
      await setDoc(doc(firebaseDb, 'events', eventId), {
        id: eventId,
        jobId: id,
        candidateId,
        eventType: 'status',
        title: `Status changed to ${status}`,
        detail: `${existing.status} → ${status}`,
        createdAt: timestamp,
      });
    }
    if (appliedResumeId)
      await updateDoc(doc(firebaseDb, 'resumes', appliedResumeId), {
        candidateVisible: true,
      });
    await audit(
      actorEmail,
      updating ? 'job.updated' : 'job.created',
      'job',
      id,
      { candidateId, company, title },
    );
    return {
      ok: true,
      message: updating
        ? `${company} ${title} was updated.`
        : `${company} ${title} was added and analyzed.`,
      id,
      match: job.matchScore,
      mandatory: mandatorySkills,
      preferred: preferredSkills,
    };
  }

  if (action === 'job.status') {
    const id = required(payload, 'id');
    const snapshot = await getDoc(doc(firebaseDb, 'jobs', id));
    if (!snapshot.exists()) throw new Error('Job not found.');
    const job = snapshot.data() as Job;
    const status = required(payload, 'status') as ApplicationStatus;
    const applied = ['Applied', 'Interview', 'Rejected', 'Offer'].includes(
      status,
    );
    if (!['Selected', 'Pending', 'Applied', 'Interview', 'Rejected', 'Offer', 'Failed'].includes(status)) throw new Error('Invalid application status.');
    if (applied && !job.appliedAt) {
      if (!(await approvedResumeForJob(id))) throw new Error('Approve a resume before recording an application.');
      const candidate = (await getDoc(doc(firebaseDb, 'candidates', job.candidateId))).data() as Candidate;
      const day = timestamp.slice(0, 10);
      const today = (await listDocuments<Job>('jobs', [where('candidateId', '==', job.candidateId)])).filter(x => x.appliedAt?.startsWith(day));
      if (today.length >= preferences(candidate.matchPreferences).dailyLimit) throw new Error('Candidate daily application limit reached (UTC).');
    }
    const appliedResumeId =
      job.appliedResumeId ??
      (applied ? ((await approvedResumeForJob(id))?.id ?? null) : null);
    await updateDoc(doc(firebaseDb, 'jobs', id), {
      status,
      appliedAt: job.appliedAt ?? (applied ? timestamp : null),
      appliedResumeId,
      updatedAt: timestamp,
    });
    if (appliedResumeId)
      await updateDoc(doc(firebaseDb, 'resumes', appliedResumeId), {
        candidateVisible: true,
      });
    const eventId = crypto.randomUUID();
    await setDoc(doc(firebaseDb, 'events', eventId), {
      id: eventId,
      jobId: id,
      candidateId: job.candidateId,
      eventType: 'status',
      title: `Status changed to ${status}`,
      detail: `${job.status} → ${status}`,
      createdAt: timestamp,
    });
    await audit(actorEmail, 'job.status_changed', 'job', id, {
      from: job.status,
      to: status,
    });
    return { ok: true, message: `Application status changed to ${status}.` };
  }

  if (action === 'job.delete') {
    const id = required(payload, 'id');
    const current = await getDoc(doc(firebaseDb, 'jobs', id));
    if (current.data()?.catalogId) throw new Error('Keep matched application history for duplicate prevention. Use status updates or close the shared job instead.');
    await Promise.all([
      deleteDoc(doc(firebaseDb, 'jobs', id)),
      removeDocuments('resumes', 'jobId', id),
      removeDocuments('events', 'jobId', id),
    ]);
    await audit(actorEmail, 'job.deleted', 'job', id);
    return {
      ok: true,
      message: 'Job and its generated versions were deleted.',
    };
  }

  if (action === 'resume.generate') {
    const jobId = required(payload, 'jobId');
    const key = adminAIKey();
    if (!key) throw new Error('Save your OpenAI API key in Admin Settings before generating.');
    const settings = await mergedSettings();
    const model = settings.system.openAIModel;
    const jobSnapshot = await getDoc(doc(firebaseDb, 'jobs', jobId));
    if (!jobSnapshot.exists()) throw new Error('Job not found.');
    const sourceJob = jobSnapshot.data() as Job;
    let job = await hydrateJob(sourceJob);
    const candidateSnapshot = await getDoc(doc(firebaseDb, 'candidates', job.candidateId));
    if (!candidateSnapshot.exists()) throw new Error('Candidate not found.');
    const candidate = candidateSnapshot.data() as Candidate;
    const missing = resumeGenerationRequiredFields(candidate);
    if (missing.length) throw new Error(`Candidate evidence is incomplete: ${missing.join(', ')}.`);
    if (job.catalogId) {
      const catalog = (await getDoc(doc(firebaseDb, 'catalogJobs', job.catalogId))).data() as CatalogJob;
      const match = evaluateMatch(catalog, candidate);
      if (match.eligibility === 'Ineligible') throw new Error('Check that the job is open and its taxonomy family matches the candidate.');
      const approved = (await getDoc(doc(firebaseDb, 'jobMatches', `${job.catalogId}_${job.candidateId}`))).data();
      if (approved?.reviewedDecision !== 'Approved' || approved.applicationId !== job.id) throw new Error('Approve this job-candidate match before generating.');
    }
    // Spend on AI only after candidate evidence and match approval pass preflight.
    if (sourceJob.catalogId) {
      await ensureCatalogProfile(user, sourceJob.catalogId, model);
      job = await hydrateJob(sourceJob);
    } else {
      const cached = await cachedJDProfile(user, job, model);
      Object.assign(job, { jdHash: cached.jdHash, analysisVersion: cached.analysisVersion, jdProfile: cached.jdProfile, intelligence: cached.intelligence });
    }
    const activePrompt = (await listDocuments<Prompt>('prompts')).filter(item => item.active).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const template = String(payload.template ?? 'Modern ATS');
    const candidateSourceHash = await sha256(candidateGenerationFacts(candidate));
    const inputHash = await sha256({ candidate: candidateGenerationFacts(candidate),
      job: { id: job.id, jdHash: job.jdHash, targetRole: job.targetRole, title: job.title, company: job.company }, model, template, customPrompt: activePrompt?.template ?? '', promptVersion: RESUME_PROMPT_VERSION });
    const result = await cachedAIRequest(`resume_${inputHash}`, async () => {
      // Recover a completed save if the request-ledger acknowledgement was interrupted.
      const recovered = await listDocuments<ResumeVersion>('resumes', [where('generationSnapshot.inputHash', '==', inputHash)]);
      if (recovered.length) return { resumeId: recovered.sort((a, b) => b.version - a.version)[0].id };
      const generated = await writeResumeWithLLM({ key, model }, candidate, job, activePrompt?.template ?? '');
      const family = await familyByName(job.family);
      const plan = buildSkillPlan(candidate.skills ?? [], family, job.mandatorySkills, job.preferredSkills, { allowFamilyContext: false, allowSupportingContext: false });
      const versions = await listDocuments<ResumeVersion>('resumes', [where('jobId', '==', jobId)]);
      const id = crypto.randomUUID();
      const counterRef = doc(firebaseDb, 'resumeCounters', jobId);
      await runTransaction(firebaseDb, async tx => {
        const counter = await tx.get(counterRef);
        const freshCandidate = await tx.get(doc(firebaseDb, 'candidates', candidate.id));
        const freshJob = await tx.get(doc(firebaseDb, job.catalogId ? 'catalogJobs' : 'jobs', job.catalogId || job.id));
        if (freshCandidate.data()?.updatedAt !== candidate.updatedAt || (job.catalogId && freshJob.data()?.jdHash !== job.jdHash) || (!job.catalogId && freshJob.data()?.updatedAt !== job.updatedAt))
          throw new Error('Candidate or JD changed during generation. Refresh before generating again.');
        const version = Math.max(Number(counter.data()?.version ?? 0), ...versions.map(v => v.version), 0) + 1;
        const resume: ResumeVersion & { candidateVisible: boolean } = {
          id, candidateId: candidate.id, jobId, parentId: counter.data()?.lastId || versions.sort((a, b) => b.version - a.version)[0]?.id || null,
          version, content: generated.content, skillPlan: plan,
          scores: { jdMatch: calculateMatch(plan), ats: 0, recruiterSafe: 0, evidence: generated.validation.passed ? 100 : 0 },
          template, status: 'Ready for review', engine: generated.fallback ? 'grounded-fallback-v1' : 'openai-resume-v1', evidenceMap: generated.evidenceMap, validation: { passed: generated.validation.passed, errors: generated.validation.errors, warnings: generated.validation.warnings, claimCount: generated.validation.claimCount },
          aiMetadata: { promptVersion: generated.promptVersion, usage: generated.usage, gaps: generated.gaps, factualReviewRequired: true },
          generationSnapshot: { jdHash: job.jdHash, analysisVersion: job.analysisVersion, candidateSourceHash, candidateUpdatedAt: candidate.updatedAt, jobUpdatedAt: job.updatedAt, ...(job.catalogId ? { catalogId: job.catalogId } : {}), matchPolicyVersion: 'family-eligibility-v2', ...(activePrompt ? { promptId: activePrompt.id, promptVersion: activePrompt.version } : {}), model, template, inputHash },
          createdAt: now(), approvedAt: null, candidateVisible: false,
        };
        tx.set(doc(firebaseDb, 'resumes', id), resume);
        tx.set(counterRef, { version, lastId: id });
        tx.set(doc(firebaseDb, 'events', crypto.randomUUID()), { jobId, candidateId: candidate.id, eventType: 'resume_generated', title: generated.fallback ? 'Grounded resume generated' : 'AI resume generated', detail: `Version ${version} · ${generated.fallback ? 'safe automatic fallback' : 'cached JD profile'}`, createdAt: now() });
      });
      await audit(actorEmail, 'resume.generated', 'resume', id, { jobId, inputHash, model, engine: generated.fallback ? 'grounded-fallback-v1' : 'openai-resume-v1', fallbackReasonCount: generated.fallbackReasonCount, usage: generated.usage });
      return { resumeId: id };
    });
    const stored = await getDoc(doc(firebaseDb, 'resumes', result.resumeId));
    if (!stored.exists()) throw new Error('The cached resume was removed. Update candidate evidence or prompt before regenerating.');
    const storedResume = stored.data() as ResumeVersion;
    return { ok: true, message: storedResume.engine === 'grounded-fallback-v1' ? 'Resume ready for review. AI wording was automatically replaced with a grounded draft.' : 'AI resume ready for factual review. Unchanged inputs reuse the existing version.', resume: storedResume, mode: storedResume.engine === 'grounded-fallback-v1' ? 'grounded-fallback' : 'openai' };
  }

  if (action === 'resume.edit') {
    const parentId = required(payload, 'id');
    const content = payload.content as ResumeContent;
    if (!content?.name || !content.summary || !Array.isArray(content.skills))
      throw new Error('Complete resume content is required.');
    const parentSnapshot = await getDoc(doc(firebaseDb, 'resumes', parentId));
    if (!parentSnapshot.exists()) throw new Error('Resume not found.');
    const parent = parentSnapshot.data() as ResumeVersion;
    if (parent.aiMetadata) validateAIResumeEdit(content, parent.content, parent.evidenceMap ?? []);
    const validation = parent.evidenceMap?.length
      ? validateGrounding(content, parent.evidenceMap)
      : undefined;
    if (validation && !validation.passed)
      throw new Error(`Resume edit contains unsupported claims: ${validation.errors.join('; ')}`);
    const versions = await listDocuments<ResumeVersion>('resumes', [
      where('jobId', '==', parent.jobId),
    ]);
    const version = Math.max(0, ...versions.map((item) => item.version)) + 1;
    const id = crypto.randomUUID();
    await setDoc(doc(firebaseDb, 'resumes', id), {
      ...parent,
      id,
      parentId,
      version,
      content,
      evidenceMap: parent.evidenceMap ?? [],
      validation: validation ?? parent.validation,
      status: 'Ready for review',
      engine: 'admin-edit',
      ...(parent.aiMetadata ? { aiMetadata: { ...parent.aiMetadata, factualReviewRequired: true } } : {}),
      createdAt: timestamp,
      approvedAt: null,
      candidateVisible: false,
    });
    await audit(actorEmail, 'resume.edited', 'resume', id, {
      parentId,
      version,
    });
    return { ok: true, message: `Edits saved as version ${version}.`, id };
  }

  if (action === 'resume.approve') {
    const id = required(payload, 'id');
    const resumeSnapshot = await getDoc(doc(firebaseDb, 'resumes', id));
    if (!resumeSnapshot.exists()) throw new Error('Resume not found.');
    const resume = resumeSnapshot.data() as ResumeVersion;
    if (resume.validation && !resume.validation.passed) throw new Error('This resume has failed validation.');
    if (resume.aiMetadata && payload.factualReviewConfirmed !== true) throw new Error('Review the AI wording and confirm factual accuracy before approving.');
    if (resume.aiMetadata && resume.generationSnapshot) {
      const currentCandidate = await getDoc(doc(firebaseDb, 'candidates', resume.candidateId));
      if (!currentCandidate.exists()) throw new Error('Candidate no longer exists.');
      const factsChanged = resume.generationSnapshot.candidateSourceHash
        ? await sha256(candidateGenerationFacts(currentCandidate.data() as Candidate)) !== resume.generationSnapshot.candidateSourceHash
        : currentCandidate.data().updatedAt !== resume.generationSnapshot.candidateUpdatedAt;
      if (factsChanged) throw new Error('Candidate records changed after generation. Regenerate and review before approval.');
      if (resume.generationSnapshot.catalogId) {
        const source = await getDoc(doc(firebaseDb, 'catalogJobs', resume.generationSnapshot.catalogId));
        if (!source.exists() || source.data().jdHash !== resume.generationSnapshot.jdHash) throw new Error('The JD profile changed. Regenerate before approval.');
      }
    }
    const versions = await listDocuments<
      ResumeVersion & { candidateVisible?: boolean }
    >('resumes', [where('jobId', '==', resume.jobId)]);
    const jobSnapshot = await getDoc(doc(firebaseDb, 'jobs', resume.jobId));
    const job = jobSnapshot.data() as Job;
    const batch = writeBatch(firebaseDb);
    for (const version of versions) {
      if (version.id === id) continue;
      if (version.status === 'Approved') {
        batch.update(doc(firebaseDb, 'resumes', version.id), {
          status: 'Superseded',
          candidateVisible: job.appliedResumeId === version.id,
        });
      }
    }
    batch.update(doc(firebaseDb, 'resumes', id), {
      status: 'Approved',
      approvedAt: timestamp,
      ...(resume.aiMetadata ? { aiMetadata: { ...resume.aiMetadata, factualReviewRequired: false }, factualReviewedBy: actorEmail, factualReviewedAt: timestamp } : {}),
      candidateVisible: true,
    });
    const applied = ['Applied', 'Interview', 'Rejected', 'Offer'].includes(
      job.status,
    );
    if (applied && !job.appliedResumeId)
      batch.update(doc(firebaseDb, 'jobs', job.id), {
        appliedResumeId: id,
        updatedAt: timestamp,
      });
    const eventId = crypto.randomUUID();
    batch.set(doc(firebaseDb, 'events', eventId), {
      id: eventId,
      jobId: resume.jobId,
      candidateId: resume.candidateId,
      eventType: 'resume_approved',
      title: 'Resume approved',
      detail: 'Published to the candidate portal',
      createdAt: timestamp,
    });
    await batch.commit();
    await audit(actorEmail, 'resume.approved', 'resume', id, {
      jobId: resume.jobId,
    });
    return {
      ok: true,
      message: 'Resume approved and published to the candidate portal.',
    };
  }

  if (action === 'family.save') {
    const id = String(payload.id ?? crypto.randomUUID());
    const existing = await getDoc(doc(firebaseDb, 'families', id));
    const current = existing.exists()
      ? (existing.data() as JobFamily)
      : undefined;
    const family: JobFamily = {
      id,
      name: required(payload, 'name'),
      description: String(payload.description ?? ''),
      roles: words(payload.roles),
      skills: words(payload.skills),
      active: payload.active !== false,
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    await setDoc(doc(firebaseDb, 'families', id), family);
    await audit(actorEmail, 'family.saved', 'job_family', id, {
      name: family.name,
      roles: family.roles.length,
    });
    return { ok: true, message: `${family.name} taxonomy saved.`, id };
  }

  if (action === 'family.delete') {
    const id = required(payload, 'id');
    const familySnapshot = await getDoc(doc(firebaseDb, 'families', id));
    if (!familySnapshot.exists()) throw new Error('Job family not found.');
    const family = familySnapshot.data() as JobFamily;
    const candidates = await listDocuments<Candidate>('candidates', [
      where('family', '==', family.name),
    ]);
    if (candidates.some((candidate) => candidate.status !== 'Archived'))
      throw new Error(
        'This family is assigned to active candidates. Reassign them before deleting it.',
      );
    await deleteDoc(doc(firebaseDb, 'families', id));
    await audit(actorEmail, 'family.deleted', 'job_family', id, {
      name: family.name,
    });
    return { ok: true, message: `${family.name} was deleted.` };
  }

  if (action === 'prompt.save') {
    const id = String(payload.id ?? crypto.randomUUID());
    const current = await getDoc(doc(firebaseDb, 'prompts', id));
    const previous = current.exists() ? (current.data() as Prompt) : undefined;
    const prompt: Prompt = {
      id,
      name: required(payload, 'name'),
      scope: String(payload.scope ?? 'Global'),
      template: required(payload, 'template'),
      version: (previous?.version ?? 0) + 1,
      active: payload.active !== false,
      createdAt: previous?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    await setDoc(doc(firebaseDb, 'prompts', id), prompt);
    await audit(actorEmail, 'prompt.saved', 'prompt', id, {
      name: prompt.name,
      version: prompt.version,
    });
    return {
      ok: true,
      message: `${prompt.name} version ${prompt.version} saved.`,
      id,
    };
  }

  if (action === 'settings.update') {
    const settings = payload.settings as PlatformSettings;
    if (!settings?.portalName || !settings.primaryColor)
      throw new Error('Complete platform settings are required.');
    await setDoc(doc(firebaseDb, 'settings', 'platform'), settings);
    await audit(actorEmail, 'settings.updated', 'settings', 'platform');
    return { ok: true, message: 'Platform settings were saved.' };
  }

  if (action === 'announcement.save') {
    const id = String(payload.id ?? crypto.randomUUID());
    const existing = await getDoc(doc(firebaseDb, 'announcements', id));
    const current = existing.exists()
      ? (existing.data() as Announcement)
      : undefined;
    const announcement: Announcement = {
      id,
      title: required(payload, 'title'),
      message: required(payload, 'message'),
      active: payload.active !== false,
      createdAt: current?.createdAt ?? timestamp,
    };
    await setDoc(doc(firebaseDb, 'announcements', id), announcement);
    await audit(actorEmail, 'announcement.saved', 'announcement', id, {
      title: announcement.title,
    });
    return { ok: true, message: 'Candidate announcement published.', id };
  }

  if (action === 'announcement.delete') {
    const id = required(payload, 'id');
    await deleteDoc(doc(firebaseDb, 'announcements', id));
    await audit(actorEmail, 'announcement.deleted', 'announcement', id);
    return { ok: true, message: 'Announcement deleted.' };
  }

  if (action === 'evaluation.run') {
    const currentState = await readFirebaseState(user);
    const health = evaluateReleaseHealth(currentState, true);
    const evidenceSafe = currentState.resumes.every(
      (item) => item.scores.recruiterSafe >= 90 && item.scores.evidence >= 90,
    );
    const score = evidenceSafe ? health.score : Math.min(health.score, 70);
    const id = crypto.randomUUID();
    const evaluation: Evaluation = {
      id,
      name: 'Production release gate',
      status: score === 100 ? 'Passed' : 'Blocked',
      score,
      results: { evidenceSafe, checks: health.checks },
      createdAt: timestamp,
    };
    await setDoc(doc(firebaseDb, 'evaluations', id), evaluation);
    await audit(
      actorEmail,
      'evaluation.completed',
      'evaluation',
      id,
      evaluation.results,
    );
    return {
      ok: true,
      message:
        score === 100
          ? 'Release gate passed. Production data is healthy.'
          : `Release blocked: ${health.total - health.passed} check(s) need attention.`,
      id,
      score,
    };
  }

  throw new Error(`Unknown action: ${action}`);
}

export async function readOnboardingInvite(id: string) {
  const snapshot = await getDoc(doc(firebaseDb, 'onboardingInvites', id));
  if (!snapshot.exists()) throw new Error('This onboarding link is invalid.');
  const invite = snapshot.data() as OnboardingInvite;
  if (invite.status !== 'Open' || Date.parse(invite.expiresAt) <= Date.now()) throw new Error('This onboarding link has expired or was already used.');
  return invite;
}

export async function readPublicFamilies() {
  return (await listDocuments<JobFamily>('families')).filter(item => item.active).sort((a, b) => a.name.localeCompare(b.name));
}

export async function submitOnboarding(input: Omit<OnboardingSubmission, 'id' | 'status' | 'submittedAt'>) {
  const invite = await readOnboardingInvite(input.inviteId);
  const existing = await getDocs(query(collection(firebaseDb, 'onboardingSubmissions'), where('inviteId', '==', input.inviteId)));
  if (!existing.empty) throw new Error('This onboarding link has already been submitted.');
  const email = input.email.trim().toLowerCase();
  const career = careerSchema.parse(input.career);
  const gaps = [...candidateRequiredFields({ ...input, email }), ...careerRequiredFields(career)];
  if (gaps.length) throw new Error(`Complete required fields: ${gaps.join(', ')}.`);
  const id = crypto.randomUUID();
  const submission: OnboardingSubmission = { ...input, email, career, id, status: 'Pending', submittedAt: now() };
  await setDoc(doc(firebaseDb, 'onboardingSubmissions', id), submission);
  void invite;
  return { ok: true, message: 'Your information was submitted for admin approval.' };
}

export async function connectFirebaseOpenAI(
  user: User,
  apiKey: string,
): Promise<FirebaseActionResult> {
  requireAdmin(user);
  const normalized = apiKey.trim();
  if (!normalized.startsWith('sk-') || normalized.length < 20)
    throw new Error('Enter a valid OpenAI API key.');
  window.localStorage.setItem(openAIKeyName, normalized);
  window.localStorage.setItem(
    openAIMetadataName,
    JSON.stringify({ lastFour: normalized.slice(-4), updatedAt: now() }),
  );
  await audit(
    user.email ?? ADMIN_EMAIL,
    'credential.connected',
    'credential',
    'openai',
    {
      lastFour: normalized.slice(-4),
      storage: 'admin-browser-only',
    },
  );
  return {
    ok: true,
    message: 'OpenAI is connected on this administrator browser.',
  };
}

export async function disconnectFirebaseOpenAI(
  user: User,
): Promise<FirebaseActionResult> {
  requireAdmin(user);
  window.localStorage.removeItem(openAIKeyName);
  window.localStorage.removeItem(openAIMetadataName);
  await audit(
    user.email ?? ADMIN_EMAIL,
    'credential.disconnected',
    'credential',
    'openai',
  );
  return { ok: true, message: 'OpenAI was disconnected from this browser.' };
}

export { firebaseDb };
