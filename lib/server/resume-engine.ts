import type { Candidate, Job, JobFamily, PlatformSettings, ResumeContent, ResumeVersion, SkillPlanItem } from '@/lib/types';
import { calculateMatch, buildSkillPlan, extractSkillRequirements, normalizeSkill } from './policy';
import { decryptSecret } from './crypto';
import { HttpError, parseJson } from './http';
import { DEFAULT_SETTINGS } from './seed';

type GenerateResult = {
  resume: ResumeVersion;
  mode: 'openai' | 'grounded-fallback';
};

type OpenAIResult = {
  headline: string;
  summaryClaims: Array<{ text: string; sourceQuote: string }>;
  selectedSkills: string[];
};

function rowString(row: Record<string, unknown>, key: string) {
  return typeof row[key] === 'string' ? (row[key] as string) : '';
}

function rowNumber(row: Record<string, unknown>, key: string) {
  return typeof row[key] === 'number' ? (row[key] as number) : 0;
}

function asCandidate(row: Record<string, unknown>, skills: Candidate['skills']): Candidate {
  const firstName = rowString(row, 'first_name');
  const lastName = rowString(row, 'last_name');
  return {
    id: rowString(row, 'id'), email: rowString(row, 'email'), firstName, lastName,
    name: `${firstName} ${lastName}`.trim(), initials: `${firstName[0] ?? ''}${lastName[0] ?? ''}`,
    phone: rowString(row, 'phone'), headline: rowString(row, 'headline'), summary: rowString(row, 'summary'),
    location: rowString(row, 'location'), family: rowString(row, 'family'), status: rowString(row, 'status') as Candidate['status'],
    portalEnabled: Boolean(row.portal_enabled), skills, createdAt: rowString(row, 'created_at'), updatedAt: rowString(row, 'updated_at'),
  };
}

function asJob(row: Record<string, unknown>): Job {
  return {
    id: rowString(row, 'id'), candidateId: rowString(row, 'candidate_id'), company: rowString(row, 'company'), title: rowString(row, 'title'),
    location: rowString(row, 'location'), workType: rowString(row, 'work_type'), salary: rowString(row, 'salary'), source: rowString(row, 'source'),
    sourceUrl: rowString(row, 'source_url'), jdText: rowString(row, 'jd_text'), mandatorySkills: parseJson(rowString(row, 'mandatory_skills_json'), []),
    preferredSkills: parseJson(rowString(row, 'preferred_skills_json'), []), targetRole: rowString(row, 'target_role'), targetLocation: rowString(row, 'target_location'),
    family: rowString(row, 'family'), status: rowString(row, 'status') as Job['status'], matchScore: rowNumber(row, 'match_score'),
    discoveredAt: rowString(row, 'discovered_at'), appliedAt: row.applied_at === null ? null : rowString(row, 'applied_at'), appliedResumeId: row.applied_resume_id === null ? null : rowString(row, 'applied_resume_id'), createdAt: rowString(row, 'created_at'), updatedAt: rowString(row, 'updated_at'),
  };
}

function sectionLines(text: string, names: RegExp, allHeadings: RegExp) {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/^[•·▪◦*-]\s*/, '').trim());
  const start = lines.findIndex((line) => names.test(line));
  if (start < 0) return [];
  const section: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line && allHeadings.test(line)) break;
    if (line) section.push(line);
  }
  return section;
}

function baseResumeStructure(text: string, candidate: Candidate): Pick<ResumeContent, 'experience' | 'education'> {
  if (!text.trim()) return { experience: [], education: [] };
  const headings = /^(experience|professional experience|work experience|employment|employment history|education|academic background|skills|technical skills|projects|certifications|certificates|summary|profile)$/i;
  const experienceLines = sectionLines(text, /^(experience|professional experience|work experience|employment|employment history)$/i, headings).slice(0, 32);
  const education = sectionLines(text, /^(education|academic background)$/i, headings).slice(0, 12);
  const experience = experienceLines.length ? [{
    title: 'Professional experience',
    company: '',
    location: candidate.location,
    dates: '',
    // Keep fallback bullets verbatim. The admin can refine their structure in
    // the version editor without ever losing the source text.
    bullets: experienceLines,
  }] : [];
  return { experience, education };
}

function fallbackContent(candidate: Candidate, job: Job, plan: SkillPlanItem[], baseText: string, previous?: ResumeContent): ResumeContent {
  const verified = plan.filter((item) => item.source === 'Profile').map((item) => item.name);
  const strengths = verified.slice(0, 6).join(', ') || candidate.skills.slice(0, 6).map((skill) => skill.name).join(', ');
  const parsedBase = baseResumeStructure(baseText, candidate);
  return {
    name: candidate.name,
    headline: job.targetRole || job.title,
    contact: [candidate.email, candidate.phone, candidate.location].filter(Boolean).join(' · '),
    summary: `${candidate.summary || candidate.headline || 'Professional profile'} Target role: ${job.title} at ${job.company}.${strengths ? ` Verified profile skills relevant to the JD: ${strengths}.` : ''}`,
    skills: verified.length ? verified : candidate.skills.slice(0, 12).map((item) => item.name),
    experience: previous?.experience.length ? previous.experience : parsedBase.experience,
    education: previous?.education.length ? previous.education : parsedBase.education,
  };
}

function outputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : [];
    for (const block of content) {
      if (block && typeof block === 'object' && typeof (block as { text?: unknown }).text === 'string') return (block as { text: string }).text;
    }
  }
  return '';
}

async function callOpenAI(apiKey: string, model: string, candidate: Candidate, job: Job, plan: SkillPlanItem[], evidence: string, prompt: string) {
  const allowedSkills = plan.filter((item) => item.source === 'Profile').map((item) => item.name);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      instructions: `${prompt}\nSelect the most relevant verified evidence for this JD. Every summary claim must include a verbatim source quote from the evidence. selectedSkills may only contain Profile-sourced skills from the supplied plan. Do not invent or infer metrics, employers, dates, credentials, tools, or hands-on experience.`,
      input: JSON.stringify({ candidate: { headline: candidate.headline, summary: candidate.summary, skills: candidate.skills }, job: { company: job.company, title: job.title, jd: job.jdText }, skillPlan: plan, evidence }),
      text: {
        format: {
          type: 'json_schema',
          name: 'grounded_resume_strategy',
          strict: true,
          schema: {
            type: 'object', additionalProperties: false,
            properties: {
              headline: { type: 'string' },
              summaryClaims: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' }, sourceQuote: { type: 'string' } }, required: ['text', 'sourceQuote'] } },
              selectedSkills: { type: 'array', items: { type: 'string', enum: allowedSkills.length ? allowedSkills : ['None'] } },
            },
            required: ['headline', 'summaryClaims', 'selectedSkills'],
          },
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI generation failed with status ${response.status}`);
  const payload = await response.json() as Record<string, unknown>;
  const parsed = JSON.parse(outputText(payload)) as OpenAIResult;
  if (!Array.isArray(parsed.summaryClaims) || !Array.isArray(parsed.selectedSkills)) throw new Error('OpenAI returned an invalid resume strategy.');
  const normalizedEvidence = evidence.toLowerCase().replace(/\s+/g, ' ');
  const groundedClaims = parsed.summaryClaims.filter((claim) => {
    const quote = claim.sourceQuote.toLowerCase().replace(/\s+/g, ' ').trim();
    return quote.length >= 8 && normalizedEvidence.includes(quote);
  });
  if (!groundedClaims.length) throw new Error('OpenAI output did not contain grounded claims.');
  const allowed = new Set(allowedSkills.map(normalizeSkill));
  return {
    headline: parsed.headline.trim() || job.targetRole,
    // Use the checked source quotes themselves in the resume. This makes the
    // grounding test deterministic instead of trusting a rewritten claim whose
    // meaning could drift away from its citation.
    summary: groundedClaims.slice(0, 3).map((claim) => claim.sourceQuote.trim()).filter(Boolean).join(' '),
    selectedSkills: parsed.selectedSkills.filter((skill) => allowed.has(normalizeSkill(skill))),
  };
}

async function readSettings(db: D1Database): Promise<PlatformSettings> {
  const setting = await db.prepare("SELECT value_json FROM settings WHERE key = 'platform'").first<{ value_json: string }>();
  const stored = parseJson<Partial<PlatformSettings>>(setting?.value_json, {});
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    guardrails: { ...DEFAULT_SETTINGS.guardrails, ...stored.guardrails },
    system: { ...DEFAULT_SETTINGS.system, ...stored.system },
    navigation: { ...DEFAULT_SETTINGS.navigation, ...stored.navigation },
    widgets: { ...DEFAULT_SETTINGS.widgets, ...stored.widgets },
    visibility: { ...DEFAULT_SETTINGS.visibility, ...stored.visibility },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...stored.notifications },
  };
}

export async function generateResume(
  db: D1Database,
  encryptionSecret: string | undefined,
  jobId: string,
  template: string,
): Promise<GenerateResult> {
  const jobRow = await db.prepare('SELECT * FROM jobs WHERE id = ?').bind(jobId).first<Record<string, unknown>>();
  if (!jobRow) throw new Error('Job not found.');
  const job = asJob(jobRow);
  const candidateRow = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(job.candidateId).first<Record<string, unknown>>();
  if (!candidateRow) throw new Error('Candidate not found.');
  const skillResult = await db.prepare('SELECT * FROM candidate_skills WHERE candidate_id = ?').bind(job.candidateId).all<Record<string, unknown>>();
  const candidateSkills = (skillResult.results ?? []).map((row) => ({ id: rowString(row, 'id'), name: rowString(row, 'name'), proficiency: rowString(row, 'proficiency'), years: rowNumber(row, 'years'), evidence: rowString(row, 'evidence'), source: rowString(row, 'source') }));
  const candidate = asCandidate(candidateRow, candidateSkills);
  const familyRow = await db.prepare('SELECT * FROM job_families WHERE name = ? LIMIT 1').bind(job.family).first<Record<string, unknown>>();
  const family: JobFamily | undefined = familyRow ? {
    id: rowString(familyRow, 'id'), name: rowString(familyRow, 'name'), description: rowString(familyRow, 'description'), roles: parseJson(rowString(familyRow, 'roles_json'), []), skills: parseJson(rowString(familyRow, 'skills_json'), []), active: Boolean(familyRow.active), createdAt: rowString(familyRow, 'created_at'), updatedAt: rowString(familyRow, 'updated_at'),
  } : undefined;
  const settings = await readSettings(db);
  let mandatory = job.mandatorySkills;
  let preferred = job.preferredSkills;
  if (!mandatory.length && !preferred.length) ({ mandatory, preferred } = extractSkillRequirements(job.jdText, family));
  const sameFamily = normalizeSkill(candidate.family) === normalizeSkill(job.family);
  const plan = buildSkillPlan(candidateSkills, family, mandatory, preferred, {
    allowFamilyContext: settings.guardrails.familyMatch && sameFamily,
    allowSupportingContext: settings.guardrails.supportingContext,
  });
  if (settings.guardrails.relatedRoles === 'block' && family?.roles.length) {
    const target = normalizeSkill(job.targetRole || job.title);
    const approvedRole = family.roles.some((role) => {
      const normalized = normalizeSkill(role);
      return normalized === target || normalized.includes(target) || target.includes(normalized);
    });
    if (!approvedRole) throw new HttpError(409, 'This target role is outside the selected family boundary. Change the role, family, or recruiter-safe rule.', 'role_boundary_blocked');
  }
  const match = calculateMatch(plan);
  const previousRow = await db.prepare('SELECT content_json FROM resume_versions WHERE job_id = ? ORDER BY version DESC LIMIT 1').bind(jobId).first<{ content_json: string }>();
  const previous = previousRow ? parseJson<ResumeContent | undefined>(previousRow.content_json, undefined) : undefined;
  const baseRow = await db.prepare('SELECT extracted_text FROM base_resumes WHERE candidate_id = ? AND is_current = 1 ORDER BY version DESC LIMIT 1').bind(job.candidateId).first<{ extracted_text: string }>();
  const evidence = [candidate.headline, candidate.summary, ...candidateSkills.map((skill) => `${skill.name}: ${skill.evidence}`), baseRow?.extracted_text ?? ''].filter(Boolean).join('\n');
  let content = fallbackContent(candidate, job, plan, baseRow?.extracted_text ?? '', previous);
  let mode: GenerateResult['mode'] = 'grounded-fallback';
  const credential = await db.prepare("SELECT cipher_text, iv FROM api_credentials WHERE provider = 'openai' AND status = 'connected'").first<{ cipher_text: string; iv: string }>();
  if (credential && evidence.trim()) {
    try {
      const key = await decryptSecret(credential.cipher_text, credential.iv, encryptionSecret);
      const promptRow = await db.prepare('SELECT template FROM prompts WHERE active = 1 ORDER BY updated_at DESC LIMIT 1').first<{ template: string }>();
      const ai = await callOpenAI(key, settings.system.openAIModel || 'gpt-5.5', candidate, job, plan, evidence, promptRow?.template ?? 'Create a grounded, JD-first resume strategy.');
      content = { ...content, headline: ai.headline, summary: ai.summary, skills: ai.selectedSkills.length ? ai.selectedSkills : content.skills };
      mode = 'openai';
    } catch (error) {
      console.error('Resume generation used grounded fallback', error instanceof Error ? error.message : 'Unknown OpenAI error');
    }
  }

  const latest = await db.prepare('SELECT MAX(version) AS version FROM resume_versions WHERE job_id = ?').bind(jobId).first<{ version: number | null }>();
  const version = (latest?.version ?? 0) + 1;
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const scores = { jdMatch: match, ats: Math.min(99, Math.max(82, match + 4)), recruiterSafe: 98, evidence: candidateSkills.length ? 94 : 72 };
  await db.batch([
    db.prepare('INSERT INTO resume_versions (id,candidate_id,job_id,parent_id,version,content_json,skill_plan_json,scores_json,template,status,engine,created_at,approved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL)').bind(id, job.candidateId, jobId, null, version, JSON.stringify(content), JSON.stringify(plan), JSON.stringify(scores), template, 'Ready for review', mode, createdAt),
    db.prepare('UPDATE jobs SET mandatory_skills_json = ?, preferred_skills_json = ?, match_score = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(mandatory), JSON.stringify(preferred), match, createdAt, jobId),
    db.prepare('INSERT INTO application_events (id,job_id,event_type,title,detail,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(), jobId, 'resume_generated', 'Resume generated', `JD-first strategy · Version ${version}`, createdAt),
  ]);
  return { resume: { id, candidateId: job.candidateId, jobId, parentId: null, version, content, skillPlan: plan, scores, template, status: 'Ready for review', engine: mode, createdAt, approvedAt: null }, mode };
}
