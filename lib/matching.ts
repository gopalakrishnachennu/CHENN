import type { Candidate } from './types';
import type { JDCoverage, JDAnalysis, ResumeGenerationPlan, StructuredJobRequirements } from './jd-intelligence';
import { analyzeJD, extractStructuredRequirements } from './jd-intelligence';
import { candidateRequiredFields } from './requirements';

export type CandidatePreferences = {
  secondaryFamilies: string[]; targetRoles: string[]; locations: string[];
  workTypes: string[]; authorizations: string[]; seniorities: string[];
  yearsExperience: number | null; minimumSalary: number | null; currency: string;
  minimumScore: number; dailyLimit: number;
};
export type CatalogJob = {
  id: string; company: string; title: string; family: string; role: string;
  familyConfidence: number; mandatorySkills: string[]; preferredSkills: string[];
  criticalSkills: string[]; seniority: string; minimumYears: number | null;
  location: string; workType: string; authorization: string; salaryMax: number | null;
  currency: string; source: string; sourceUrl: string; jdText: string;
  status: 'Open' | 'Closed'; expiresAt: string; createdAt: string; updatedAt: string;
  requirements?: StructuredJobRequirements;
  intelligence?: JDAnalysis;
  salary?: string;
  jdHash?: string;
  analysisVersion?: string;
  jdProfile?: import('./jd-profile').JDProfile;
};
export type JobMatch = {
  id: string; jobId: string; candidateId: string; eligibility: 'Eligible' | 'Review' | 'Ineligible';
  score: number; scores: { skills: number; role: number; location: number; experience: number; preferences: number };
  missingMandatory: string[]; reasons: string[]; decision: 'Selected' | 'Review' | 'Rejected';
  reviewedDecision?: 'Approved' | 'Rejected'; reviewReason?: string; reviewedAt?: string; reviewedBy?: string; applicationId?: string;
  updatedAt: string; policyVersion: string;
  jdCoverage?: JDCoverage; resumePlan?: ResumeGenerationPlan;
};
export const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
const aliases: Record<string, string> = { 'amazon web services': 'aws', 'k8s': 'kubernetes', 'nodejs': 'node.js', 'node js': 'node.js', 'gcp': 'google cloud', 'sre': 'site reliability engineer' };
export const canonical = (value: string) => aliases[normalize(value)] ?? normalize(value);
export const textValue = (value: unknown, fallback = '') => {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') throw new Error('Expected text.');
  return value.trim();
};
export const splitValues = (value: unknown): string[] => [...new Set((Array.isArray(value) ? value.map(x => textValue(x)) : textValue(value).split(/[,\n]/)).map(x => x.trim()).filter(Boolean))];
const number = (value: unknown, fallback: number | null, min = 0, max = 1e9) => {
  if (value === '' || value == null) return fallback;
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max) throw new Error(`Number must be between ${min} and ${max}.`);
  return result;
};
export function preferences(input: Partial<CandidatePreferences> = {}): CandidatePreferences {
  return { secondaryFamilies: splitValues(input.secondaryFamilies), targetRoles: splitValues(input.targetRoles),
    locations: splitValues(input.locations), workTypes: splitValues(input.workTypes), authorizations: splitValues(input.authorizations), seniorities: splitValues(input.seniorities),
    yearsExperience: number(input.yearsExperience, null, 0, 70), minimumSalary: number(input.minimumSalary, null),
    currency: String(input.currency || 'USD').toUpperCase(), minimumScore: number(input.minimumScore, 85, 70, 100)!, dailyLimit: Math.floor(number(input.dailyLimit, 10, 1, 1000)!) };
}
export function normalizeJob(input: Record<string, unknown>, now = new Date().toISOString(), deferAnalysis = false): Omit<CatalogJob, 'id'> {
  const required = (key: string) => { const value = textValue(input[key]); if (!value) throw new Error(`${key} is required.`); return value; };
  let sourceUrl = required('sourceUrl');
  const salary = required('salary');
  if (sourceUrl) {
    const url = new URL(sourceUrl);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Job URL must use HTTPS or HTTP.');
    url.hash = ''; const trackingKeys = Array.from(url.searchParams.keys()).filter(key => /^(utm_|ref$|tracking|trk$)/i.test(key));
    for (const key of trackingKeys) url.searchParams.delete(key);
    url.searchParams.sort(); sourceUrl = url.toString();
  }
  const expiresAt = textValue(input.expiresAt, new Date(Date.parse(now) + 30 * 86400000).toISOString());
  if (!Number.isFinite(Date.parse(expiresAt))) throw new Error('Invalid expiry date.');
  const title = required('title');
  const jdText = required('jdText');
  const analyzed = deferAnalysis ? {} : { requirements: extractStructuredRequirements(jdText), intelligence: analyzeJD({ title, jdText, company: textValue(input.company), family: textValue(input.family) }) };
  return { company: required('company'), title, family: required('family'), role: textValue(input.role, title),
    familyConfidence: number(input.familyConfidence, 100, 0, 100)!, mandatorySkills: splitValues(input.mandatorySkills), preferredSkills: splitValues(input.preferredSkills), criticalSkills: splitValues(input.criticalSkills),
    seniority: textValue(input.seniority), minimumYears: number(input.minimumYears, null, 0, 70), location: required('location'), workType: required('workType'), authorization: textValue(input.authorization),
    salary, salaryMax: number(input.salaryMax, null), currency: textValue(input.currency, 'USD').toUpperCase(), source: textValue(input.source, 'Manual'), sourceUrl, jdText, ...analyzed,
    status: input.status === 'Closed' ? 'Closed' : 'Open',
    expiresAt: new Date(expiresAt).toISOString(), createdAt: textValue(input.createdAt, now), updatedAt: now };
}
export async function catalogId(job: Pick<CatalogJob, 'company' | 'title' | 'location'>) {
  // A shared vacancy remains one record when syndicated to different source URLs.
  const bytes = new TextEncoder().encode(JSON.stringify([job.company, job.title, job.location].map(normalize)));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function evaluateMatch(job: CatalogJob, candidate: Candidate, at = new Date()): JobMatch {
  const p = preferences(candidate.matchPreferences);
  const blocked: string[] = []; const uncertain: string[] = [];
  const candidateGaps = candidateRequiredFields(candidate);
  if (candidateGaps.length) uncertain.push(`Candidate profile incomplete: ${candidateGaps.join(', ')}.`);
  const inList = (list: string[], value: string) => list.some(x => canonical(x) === canonical(value));
  if (candidate.status !== 'Active') blocked.push('Candidate is not active.');
  if (job.status !== 'Open' || Date.parse(job.expiresAt) <= at.getTime()) blocked.push('Job is closed or expired.');
  if (!inList([candidate.family, ...p.secondaryFamilies], job.family)) blocked.push('Job family is not approved for this candidate.');
  if (job.familyConfidence < 80) uncertain.push('Family classification requires review.');
  for (const [label, list, value] of [
    ['Location', p.locations, job.location], ['Work type', p.workTypes, job.workType],
    ['Authorization', p.authorizations, job.authorization], ['Seniority', p.seniorities, job.seniority],
  ] as Array<[string, string[], string]>) {
    if (!list.length || !value || /^(unknown|not specified)$/i.test(value)) uncertain.push(`${label} needs confirmation.`);
    else if (!inList(list, value) && !inList(list, 'Any')) blocked.push(`${label} does not meet candidate requirements.`);
  }
  if (job.minimumYears != null) {
    if (p.yearsExperience == null) uncertain.push('Experience needs confirmation.');
    else if (p.yearsExperience < job.minimumYears) blocked.push('Insufficient years of experience.');
  }
  if (p.minimumSalary != null) {
    if (job.salaryMax == null || job.currency !== p.currency) uncertain.push('Salary needs confirmation.');
    else if (job.salaryMax < p.minimumSalary) blocked.push('Salary is below candidate minimum.');
  }
  const verified = (candidate.skills ?? []).filter(x => ['Profile', 'Career'].includes(x.source) && x.evidence.trim()).map(x => canonical(x.name));
  const missing = [...new Set([...job.mandatorySkills, ...job.criticalSkills])].filter(x => !verified.includes(canonical(x)));
  if (job.criticalSkills.some(x => !verified.includes(canonical(x)))) blocked.push('Missing a critical mandatory skill.');
  else if (missing.length) uncertain.push('Mandatory skills require evidence review.');
  const ratio = (list: string[]) => list.length ? list.filter(x => verified.includes(canonical(x))).length / list.length * 100 : 100;
  if (!job.mandatorySkills.length && !job.preferredSkills.length) uncertain.push('JD skill requirements need review.');
  const requirements = job.requirements;
  if (requirements?.education.length && !(candidate.career?.education.length))
    uncertain.push('Education requirement needs confirmation.');
  if (requirements?.certifications.length && !(candidate.career?.certifications.length))
    uncertain.push('Certification requirement needs confirmation.');
  if (requirements?.clearance) uncertain.push('Security clearance needs confirmation.');
  if (requirements?.travel) uncertain.push('Travel requirement needs confirmation.');
  const scores = { skills: Math.round(ratio(job.mandatorySkills) * .8 + ratio(job.preferredSkills) * .2),
    role: inList(p.targetRoles, job.role) ? 100 : 40,
    location: inList(p.locations, job.location) || inList(p.locations, 'Any') ? 100 : 0,
    experience: job.minimumYears == null || p.yearsExperience == null ? 50 : p.yearsExperience >= job.minimumYears ? 100 : 0,
    preferences: blocked.length ? 0 : uncertain.some(x => /Authorization|Work type|Seniority|Salary/.test(x)) ? 50 : 100 };
  if (p.targetRoles.length && !inList(p.targetRoles, job.role)) uncertain.push('Role is not an explicit candidate target.');
  if (!p.targetRoles.length) uncertain.push('Target roles need confirmation.');
  const score = Math.round(scores.skills * .45 + scores.role * .2 + scores.experience * .15 + scores.location * .1 + scores.preferences * .1);
  const intelligence = analyzeJD({ title: job.title, jdText: job.intelligence ? '' : job.jdText, company: job.company, family: job.family }, candidate, undefined, job.intelligence);
  const decision = blocked.length || score < 70 ? 'Rejected' : uncertain.length || score < p.minimumScore ? 'Review' : 'Selected';
  return { id: `${job.id}_${candidate.id}`, jobId: job.id, candidateId: candidate.id,
    eligibility: blocked.length ? 'Ineligible' : uncertain.length ? 'Review' : 'Eligible', score, scores,
    missingMandatory: missing, reasons: [...blocked, ...uncertain, `Score ${score}/100; selection threshold ${p.minimumScore}.`], decision, updatedAt: at.toISOString(), policyVersion: 'family-eligibility-v1', jdCoverage: intelligence.coverage, resumePlan: intelligence.resumePlan };
}

// CSV parser supports quoted commas, multiline JDs, escaped quotes and UTF-8 BOMs.
export function parseJobImport(text: string): Record<string, unknown>[] {
  text = text.replace(/^\uFEFF/, '').trim();
  if (text.startsWith('[')) {
    const data = JSON.parse(text); if (!Array.isArray(data) || data.some(x => !x || typeof x !== 'object' || Array.isArray(x))) throw new Error('Expected an array of job objects.');
    if (data.length > 100) throw new Error('Import at most 100 jobs at a time.'); return adaptJobFeed(data);
  }
  if (text.startsWith('{')) {
    const envelope = JSON.parse(text) as Record<string, unknown>;
    const rows = ['jobs', 'results', 'data'].map(key => envelope[key]).find(value => Array.isArray(value));
    if (!rows) throw new Error('JSON must be an array or contain a jobs, results, or data array.');
    return adaptJobFeed(rows as Record<string, unknown>[]);
  }
  const rows: string[][] = []; let row: string[] = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (c === ',' || c === '\n')) { row.push(value.replace(/\r$/, '')); value = ''; if (c === '\n') { rows.push(row); row = []; } }
    else value += c;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  row.push(value.replace(/\r$/, '')); rows.push(row);
  const headers = rows.shift()!.map(x => x.trim());
  if (new Set(headers).size !== headers.length) throw new Error('CSV has duplicate column names.');
  if (rows.length > 100) throw new Error('Import at most 100 jobs at a time.');
  return rows.filter(r => r.some(Boolean)).map(r => { if (r.length !== headers.length) throw new Error('CSV column count does not match its headers.'); return Object.fromEntries(headers.map((h, i) => [h, r[i]])); });
}

/** Normalize common public ATS export shapes without making network calls or guessing a family. */
export function adaptJobFeed(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(row => {
    const categories = row.categories as Record<string, unknown> | undefined;
    const location = typeof row.location === 'object' && row.location ? String((row.location as Record<string, unknown>).name ?? '') : String(row.location ?? row.locationName ?? '');
    const title = row.title ?? row.name ?? '';
    return { ...row, company: row.company ?? row.companyName ?? row.organization ?? '', title,
      role: row.role ?? title, location, workType: row.workType ?? row.workplaceType ?? row.workplace_type ?? 'Not specified',
      jdText: row.jdText ?? row.description ?? row.content ?? row.text ?? '', sourceUrl: row.sourceUrl ?? row.absolute_url ?? row.hostedUrl ?? row.url ?? '',
      source: row.source ?? (row.hostedUrl ? 'Lever' : row.absolute_url ? 'Greenhouse' : 'Import'), family: row.family ?? '',
      mandatorySkills: row.mandatorySkills ?? categories?.skills ?? '' };
  });
}
