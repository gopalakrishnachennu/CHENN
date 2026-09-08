import type {
  Announcement,
  AppState,
  ApplicationEvent,
  AuditLog,
  BaseResume,
  Candidate,
  CandidateSkill,
  Evaluation,
  Job,
  JobFamily,
  PlatformSettings,
  Prompt,
  ResumeVersion,
} from '@/lib/types';
import type { AuthContext } from './auth';
import { parseJson } from './http';
import { DEFAULT_SETTINGS } from './seed';

type Row = Record<string, unknown>;

async function all(db: D1Database, sql: string, ...bindings: unknown[]) {
  const result = await db.prepare(sql).bind(...bindings).all<Row>();
  return result.results ?? [];
}

function bool(value: unknown) {
  return value === true || value === 1;
}

function string(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function number(value: unknown, fallback = 0) {
  return typeof value === 'number' ? value : fallback;
}

function mapSkill(row: Row): CandidateSkill {
  return {
    id: string(row.id),
    name: string(row.name),
    proficiency: string(row.proficiency),
    years: number(row.years),
    evidence: string(row.evidence),
    source: string(row.source),
  };
}

function mapBaseResume(row: Row): BaseResume {
  return {
    id: string(row.id),
    candidateId: string(row.candidate_id),
    version: number(row.version),
    originalName: string(row.original_name),
    mimeType: string(row.mime_type),
    byteSize: number(row.byte_size),
    extractedText: string(row.extracted_text),
    createdAt: string(row.created_at),
  };
}

function mapCandidate(row: Row, skills: CandidateSkill[], resume?: BaseResume): Candidate {
  const firstName = string(row.first_name);
  const lastName = string(row.last_name);
  return {
    id: string(row.id),
    email: string(row.email),
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    initials: `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase(),
    phone: string(row.phone),
    headline: string(row.headline),
    summary: string(row.summary),
    location: string(row.location),
    family: string(row.family, 'General'),
    status: string(row.status, 'Active') as Candidate['status'],
    portalEnabled: bool(row.portal_enabled),
    skills,
    baseResume: resume,
    createdAt: string(row.created_at),
    updatedAt: string(row.updated_at),
  };
}

function mapJob(row: Row): Job {
  return {
    id: string(row.id),
    candidateId: string(row.candidate_id),
    company: string(row.company),
    title: string(row.title),
    location: string(row.location),
    workType: string(row.work_type),
    salary: string(row.salary),
    source: string(row.source),
    sourceUrl: string(row.source_url),
    jdText: string(row.jd_text),
    mandatorySkills: parseJson(string(row.mandatory_skills_json), []),
    preferredSkills: parseJson(string(row.preferred_skills_json), []),
    targetRole: string(row.target_role),
    targetLocation: string(row.target_location),
    family: string(row.family),
    status: string(row.status) as Job['status'],
    matchScore: number(row.match_score),
    discoveredAt: string(row.discovered_at),
    appliedAt: row.applied_at === null ? null : string(row.applied_at),
    appliedResumeId: row.applied_resume_id === null ? null : string(row.applied_resume_id),
    createdAt: string(row.created_at),
    updatedAt: string(row.updated_at),
  };
}

function mapResume(row: Row): ResumeVersion {
  return {
    id: string(row.id),
    candidateId: string(row.candidate_id),
    jobId: string(row.job_id),
    parentId: row.parent_id === null ? null : string(row.parent_id),
    version: number(row.version),
    content: parseJson(string(row.content_json), { name: '', headline: '', contact: '', summary: '', skills: [], experience: [], education: [] }),
    skillPlan: parseJson(string(row.skill_plan_json), []),
    scores: parseJson(string(row.scores_json), { jdMatch: 0, ats: 0, recruiterSafe: 0, evidence: 0 }),
    template: string(row.template),
    status: string(row.status) as ResumeVersion['status'],
    engine: string(row.engine),
    createdAt: string(row.created_at),
    approvedAt: row.approved_at === null ? null : string(row.approved_at),
  };
}

export async function readState(db: D1Database, auth: AuthContext): Promise<AppState> {
  const candidateFilter = auth.role === 'candidate' ? ' WHERE id = ?' : " WHERE status != 'Archived'";
  const candidateBindings = auth.role === 'candidate' ? [auth.candidateId] : [];
  const candidateRows = await all(db, `SELECT * FROM candidates${candidateFilter} ORDER BY created_at DESC`, ...candidateBindings);
  const candidateIds = candidateRows.map((row) => string(row.id));

  const skillRows = candidateIds.length
    ? await all(db, `SELECT * FROM candidate_skills WHERE candidate_id IN (${candidateIds.map(() => '?').join(',')}) ORDER BY name`, ...candidateIds)
    : [];
  const baseRows = candidateIds.length
    ? await all(db, `SELECT * FROM base_resumes WHERE is_current = 1 AND candidate_id IN (${candidateIds.map(() => '?').join(',')}) ORDER BY version DESC`, ...candidateIds)
    : [];
  const skillsByCandidate = new Map<string, CandidateSkill[]>();
  for (const row of skillRows) {
    const id = string(row.candidate_id);
    skillsByCandidate.set(id, [...(skillsByCandidate.get(id) ?? []), mapSkill(row)]);
  }
  const resumesByCandidate = new Map<string, BaseResume>();
  for (const row of baseRows) {
    const id = string(row.candidate_id);
    if (!resumesByCandidate.has(id)) resumesByCandidate.set(id, mapBaseResume(row));
  }
  const candidates = candidateRows.map((row) => {
    const id = string(row.id);
    return mapCandidate(row, skillsByCandidate.get(id) ?? [], resumesByCandidate.get(id));
  });

  const scopedFilter = auth.role === 'candidate' ? ' WHERE candidate_id = ?' : '';
  const scopedBindings = auth.role === 'candidate' ? [auth.candidateId] : [];
  const jobRows = await all(db, `SELECT * FROM jobs${scopedFilter} ORDER BY updated_at DESC`, ...scopedBindings);
  const resumeRows = auth.role === 'candidate'
    ? await all(db, "SELECT * FROM resume_versions WHERE candidate_id=? AND (status='Approved' OR id IN (SELECT applied_resume_id FROM jobs WHERE candidate_id=? AND applied_resume_id IS NOT NULL)) ORDER BY created_at DESC", auth.candidateId, auth.candidateId)
    : await all(db, 'SELECT * FROM resume_versions ORDER BY created_at DESC');
  const jobs = jobRows.map(mapJob);
  const resumes = resumeRows.map(mapResume);
  const jobIds = jobs.map((job) => job.id);
  const eventRows = jobIds.length
    ? await all(db, `SELECT * FROM application_events WHERE job_id IN (${jobIds.map(() => '?').join(',')}) ORDER BY created_at DESC`, ...jobIds)
    : [];
  const events: ApplicationEvent[] = eventRows.map((row) => ({
    id: string(row.id), jobId: string(row.job_id), eventType: string(row.event_type), title: string(row.title), detail: string(row.detail), createdAt: string(row.created_at),
  }));

  const familyRows = await all(db, 'SELECT * FROM job_families ORDER BY name');
  const families: JobFamily[] = familyRows.map((row) => ({
    id: string(row.id), name: string(row.name), description: string(row.description), roles: parseJson(string(row.roles_json), []), skills: parseJson(string(row.skills_json), []), active: bool(row.active), createdAt: string(row.created_at), updatedAt: string(row.updated_at),
  }));
  const settingRow = await db.prepare("SELECT value_json FROM settings WHERE key = 'platform'").first<{ value_json: string }>();
  const stored = parseJson<Partial<PlatformSettings>>(settingRow?.value_json, {});
  const settings: PlatformSettings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    navigation: { ...DEFAULT_SETTINGS.navigation, ...stored.navigation },
    widgets: { ...DEFAULT_SETTINGS.widgets, ...stored.widgets },
    visibility: { ...DEFAULT_SETTINGS.visibility, ...stored.visibility },
    guardrails: { ...DEFAULT_SETTINGS.guardrails, ...stored.guardrails },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...stored.notifications },
    system: { ...DEFAULT_SETTINGS.system, ...stored.system },
  };
  const announcementRows = await all(db, auth.role === 'candidate' ? 'SELECT * FROM announcements WHERE active = 1 ORDER BY created_at DESC' : 'SELECT * FROM announcements ORDER BY created_at DESC');
  const announcements: Announcement[] = announcementRows.map((row) => ({ id: string(row.id), title: string(row.title), message: string(row.message), active: bool(row.active), createdAt: string(row.created_at) }));

  let prompts: Prompt[] = [];
  let evaluations: Evaluation[] = [];
  let logs: AuditLog[] = [];
  let credential: AppState['credential'] = { connected: false };
  if (auth.role === 'admin') {
    prompts = (await all(db, 'SELECT * FROM prompts ORDER BY updated_at DESC')).map((row) => ({ id: string(row.id), name: string(row.name), scope: string(row.scope), template: string(row.template), version: number(row.version), active: bool(row.active), createdAt: string(row.created_at), updatedAt: string(row.updated_at) }));
    evaluations = (await all(db, 'SELECT * FROM evaluations ORDER BY created_at DESC LIMIT 20')).map((row) => ({ id: string(row.id), name: string(row.name), status: string(row.status), score: number(row.score), results: parseJson(string(row.results_json), {}), createdAt: string(row.created_at) }));
    logs = (await all(db, 'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100')).map((row) => ({ id: string(row.id), actorEmail: string(row.actor_email), action: string(row.action), entityType: string(row.entity_type), entityId: string(row.entity_id), details: parseJson(string(row.details_json), {}), createdAt: string(row.created_at) }));
    const credentialRow = await db.prepare("SELECT last_four, status, updated_at FROM api_credentials WHERE provider = 'openai'").first<{ last_four: string; status: string; updated_at: string }>();
    if (credentialRow) credential = { connected: credentialRow.status === 'connected', lastFour: credentialRow.last_four, updatedAt: credentialRow.updated_at };
  }

  return {
    role: auth.role,
    user: { email: auth.email, name: auth.name, candidateId: auth.candidateId },
    candidates,
    jobs,
    resumes,
    events,
    families,
    prompts,
    settings,
    announcements,
    evaluations,
    logs,
    credential,
  };
}
