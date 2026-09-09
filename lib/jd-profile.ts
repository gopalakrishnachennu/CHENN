import { analyzeJD, extractStructuredRequirements, type JDAnalysis, type StructuredJobRequirements } from './jd-intelligence';
import { JOB_FAMILY_KNOWLEDGE } from './job-family-profiles';

export const ANALYSIS_VERSION = 'jd-profile-v1';
export type JDInput = { title: string; jdText: string; company?: string; family?: string };
export type JDProfile = {
  job_title: string; job_family: string; job_subfamily: string; seniority: string;
  mandatory_skills: string[]; required_skills: string[]; preferred_skills: string[]; adjacent_skills: string[];
  mandatory_certifications: string[]; preferred_certifications: string[];
  core_responsibilities: string[]; important_tools_technologies: string[]; ats_keywords: string[];
  priority_keywords: { P1: string[]; P2: string[]; P3: string[]; P4: string[] };
  experience_requirements: string[]; education_requirements: string[];
};
export type CachedJD = { jdHash: string; sourceHash?: string; analysisVersion: string; createdAt: string; engine: 'rules' | 'openai'; model?: string; usage?: import('./ai-client').AIUsage; jdProfile: JDProfile; intelligence: JDAnalysis; requirements: StructuredJobRequirements };
// Preserve line boundaries: requirement headings affect classification.
const normalize = (text = '') => text.normalize('NFKC').replace(/\r\n?/g, '\n').split('\n').map(line => line.trim().replace(/[\t ]+/g, ' ')).filter(Boolean).join('\n');
export async function jdFingerprint(input: JDInput) {
  const source = JSON.stringify([ANALYSIS_VERSION, JOB_FAMILY_KNOWLEDGE, normalize(input.title), normalize(input.jdText), normalize(input.company), normalize(input.family)]);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function createJDProfile(input: JDInput, jdHash: string): CachedJD {
  const intelligence = analyzeJD(input);
  const requirements = extractStructuredRequirements(input.jdText);
  const list = (classification?: string, kinds?: string[]) => [...new Set(intelligence.requirements.filter(r => r.explicit && (!classification || r.classification === classification) && (!kinds || kinds.includes(r.kind))).map(r => r.canonical))];
  const skills = ['skill', 'platform', 'tool', 'methodology'];
  // Adjacent family knowledge is a suggestion, never an asserted JD requirement.
  const adjacent = intelligence.inferredSkills.map(item => item.skill);
  return { jdHash, analysisVersion: ANALYSIS_VERSION, createdAt: new Date().toISOString(), engine: 'rules', intelligence, requirements, jdProfile: {
    job_title: intelligence.normalizedTitle, job_family: intelligence.family, job_subfamily: intelligence.subFamily, seniority: intelligence.seniority,
    mandatory_skills: list('Mandatory', skills), required_skills: list('Required', skills), preferred_skills: list('Preferred', skills), adjacent_skills: adjacent,
    mandatory_certifications: [...list('Mandatory', ['certification']), ...list('Required', ['certification'])], preferred_certifications: list('Preferred', ['certification']),
    core_responsibilities: intelligence.dayToDayResponsibilities, important_tools_technologies: list(undefined, ['platform', 'tool']), ats_keywords: list(undefined, skills),
    priority_keywords: { P1: list('Mandatory'), P2: list('Required'), P3: list('Preferred'), P4: adjacent },
    experience_requirements: list(undefined, ['experience']), education_requirements: list(undefined, ['education']),
  } };
}

export function candidateGenerationInput(profile: JDProfile, targetRole: string, evidence: unknown) {
  return JSON.stringify({ target_role: targetRole, JD_PROFILE: profile, verified_candidate_evidence: evidence });
}
export const CANDIDATE_GENERATION_GUARDRAILS = 'JD_PROFILE is already analyzed. Do not re-analyze or recreate its family, requirements or keywords. Prioritize supported P1, then P2, P3 and P4. Adjacent skills are suggestions, not verified candidate facts. Never invent experience, metrics, education or certifications; missing credentials are gaps, not resume claims. Formatting targets never override verified evidence.';
