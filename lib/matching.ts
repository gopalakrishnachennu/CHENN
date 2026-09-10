import type { Candidate } from './types';
import type { JDCoverage, JDAnalysis, ResumeGenerationPlan, StructuredJobRequirements } from './jd-intelligence';
import { analyzeJD, extractStructuredRequirements } from './jd-intelligence';

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
  sourceHash?: string;
  analysisModel?: string;
  analysisVersion?: string;
  analysisStatus?: 'Pending' | 'Ready';
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
export const MATCH_POLICY_VERSION = 'family-only-v1';
export function evaluateMatch(job: CatalogJob, candidate: Candidate, at = new Date()): JobMatch {
  const families = [candidate.family, ...(candidate.matchPreferences?.secondaryFamilies ?? [])].filter(Boolean).map(normalize);
  const assigned = !!job.family?.trim() && job.family !== 'Custom / needs review' && job.analysisStatus !== 'Pending';
  const familyMatch = assigned && families.includes(normalize(job.family));
  // Availability is separate from candidate matching: closed vacancies cannot start applications.
  const available = job.status === 'Open' && Date.parse(job.expiresAt) > at.getTime();
  const reasons = !assigned ? ['Assign a taxonomy family to this job first.']
    : familyMatch ? [`Job and candidate share the ${job.family} family.`] : ['Job family is not approved for this candidate.'];
  if (!available) reasons.push('Job is closed or expired.');
  return { id: `${job.id}_${candidate.id}`, jobId: job.id, candidateId: candidate.id,
    eligibility: familyMatch && available ? 'Eligible' : 'Ineligible',
    // Kept for existing stored-record compatibility, never presented as a qualification score.
    score: familyMatch ? 100 : 0, scores: { skills: 0, role: 0, location: 0, experience: 0, preferences: 0 },
    missingMandatory: [], reasons, decision: familyMatch && available ? 'Selected' : 'Rejected',
    updatedAt: at.toISOString(), policyVersion: MATCH_POLICY_VERSION };
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
