import { z } from 'zod';
import { structuredAI, type AIConfig } from './ai-client';
import { careerEvidence, groundedResumeContent, type EvidenceUnit } from './evidence';
import type { Candidate, ClaimEvidence, Job, ResumeContent } from './types';
import { defaultWorkflowPrompt, OUTPUT_CONTRACT, type WorkflowPrompt } from './workflow-prompts';

export const RESUME_PROMPT_VERSION = 'llm-resume-v3';
const claim = z.object({ text: z.string().min(1).max(1200), sourceRefs: z.array(z.string()).min(1).max(20), keywords: z.array(z.string()).max(30) }).strict();
export const resumeDraftSchema = z.object({
  summary: z.array(claim).min(1).max(5),
  skillCategories: z.array(z.object({ category: z.string().min(1).max(80), skills: z.array(z.string().min(1)).min(1).max(6) }).strict()).max(8),
  experience: z.array(z.object({ experienceIndex: z.number().int().min(0), bullets: z.array(claim).max(9) }).strict()).max(50),
  gaps: z.array(z.string().max(500)).max(100),
}).strict();
export type ResumeDraft = z.infer<typeof resumeDraftSchema>;
export function candidateGenerationFacts(candidate: Candidate) {
  return { id: candidate.id, name: candidate.name, email: candidate.email, phone: candidate.phone, location: candidate.location, career: candidate.career, skills: candidate.skills };
}
export const RESUME_WRITING_PROMPT = defaultWorkflowPrompt('resume-generation').template;

const norm = (value: string) => {
  const key = value.toLowerCase().replace(/[^a-z0-9+#.]/g, '');
  return ({ amazonwebservices: 'aws', k8s: 'kubernetes', nodejs: 'node.js' } as Record<string, string>)[key] ?? key;
};
export function resumeEvidence(candidate: Candidate): EvidenceUnit[] {
  const career = careerEvidence(candidate.career);
  return [...career, ...(candidate.skills ?? []).filter(s => ['Profile', 'Career'].includes(s.source)).map(s => ({ id: `skill:${s.id || norm(s.name)}`, kind: 'skill' as const, label: s.name, text: s.evidence?.trim() ? `${s.name}: ${s.evidence}` : `Candidate profile lists ${s.name}.`, skills: [s.name] }))];
}
export function allowedResumeSkills(candidate: Candidate) {
  return [...new Map(resumeEvidence(candidate).flatMap(e => e.skills).filter(Boolean).map(skill => [norm(skill), skill])).values()];
}
export function familyApprovedResumeSkills(candidate: Candidate, job: Job) {
  if (!candidate.family || !job.family || norm(candidate.family) !== norm(job.family)) return [];
  const profile = job.jdProfile;
  const skills = profile
    ? [...profile.mandatory_skills, ...profile.required_skills, ...profile.preferred_skills, ...profile.important_tools_technologies, ...profile.ats_keywords]
    : [...job.mandatorySkills, ...job.preferredSkills];
  return [...new Map(skills.filter(Boolean).map(skill => [norm(skill), skill])).values()];
}
export function generationResumeSkills(candidate: Candidate, job: Job) {
  return [...new Map([...allowedResumeSkills(candidate), ...familyApprovedResumeSkills(candidate, job)].map(skill => [norm(skill), skill])).values()];
}

function groundedSkillCategories(candidate: Candidate, job: Job) {
  const allowed = new Map(generationResumeSkills(candidate, job).map(skill => [norm(skill), skill]));
  const used = new Set<string>();
  const categories: Array<{ category: string; skills: string[] }> = [];
  const add = (category: string, values: string[]) => {
    const remaining = values.map(skill => allowed.get(norm(skill))).filter((skill): skill is string => Boolean(skill)).filter(skill => !used.has(norm(skill)));
    for (let index = 0; index < remaining.length && categories.length < 8; index += 6) {
      const group = remaining.slice(index, index + 6);
      group.forEach(skill => used.add(norm(skill)));
      categories.push({ category: index ? `${category} ${index / 6 + 1}` : category, skills: group });
    }
  };
  const profile = job.jdProfile!;
  add('Must-have skills', profile.mandatory_skills);
  add('Required skills', profile.required_skills);
  add('Tools & technologies', profile.important_tools_technologies);
  add('Preferred skills', profile.preferred_skills);
  add('Candidate skills', allowedResumeSkills(candidate));
  add('Additional JD skills', generationResumeSkills(candidate, job));
  return categories;
}

function groundedFallbackResume(candidate: Candidate, job: Job, aiErrors: string[]) {
  const skillCategories = groundedSkillCategories(candidate, job);
  const selectedSkills = skillCategories.flatMap(group => group.skills);
  const targetRole = job.targetRole || job.title;
  const roles = [...new Set((candidate.career?.experience ?? []).map(role => role.title).filter(Boolean))];
  const summaryLines = [
    `${targetRole} professional aligned with the ${job.family} job family.`,
    selectedSkills.length ? `JD-aligned technical focus: ${selectedSkills.slice(0, 12).join(', ')}.` : '',
    roles.length ? `Career history includes ${roles.slice(0, 3).join(', ')} roles.` : '',
  ].filter(Boolean);
  const base = groundedResumeContent(candidate, job, selectedSkills, summaryLines.join('\n'));
  const summaryEvidence: ClaimEvidence[] = summaryLines.map((line, index) => ({
    claimId: `summary:grounded:${index}`,
    section: 'summary',
    outputText: line,
    sourceRef: index === 1 ? 'family:approved-jd-skills' : index === 2 ? 'candidate:career-records' : 'family:approved-assignment',
    sourceText: index === 1
      ? `Candidate and job share ${job.family}. Approved JD skills: ${selectedSkills.join(', ')}`
      : index === 2
        ? (candidate.career?.experience ?? []).map(role => `${role.title} at ${role.company}`).join('; ')
        : `Candidate and job share the ${job.family} taxonomy family.`,
  }));
  const evidenceMap = [...summaryEvidence, ...base.evidenceMap];
  const fallbackWarning = 'The AI wording did not pass the final resume check, so ResumeOS automatically created this grounded draft from stored candidate facts and same-family JD skills.';
  return {
    content: { ...base.content, skillCategories, highlights: selectedSkills },
    evidenceMap,
    validation: { passed: true, errors: [], warnings: [fallbackWarning], claimCount: evidenceMap.length },
    gaps: [],
    fallback: true,
    fallbackReasonCount: aiErrors.length,
    rejectedDraftErrors: aiErrors,
  };
}
export function resumeRoles(candidate: Candidate, evidence = resumeEvidence(candidate)) {
  return (candidate.career?.experience ?? []).map((role, index) => ({ ...role, experienceIndex: index }))
    .sort((a, b) => Number(b.current) - Number(a.current) || b.start.localeCompare(a.start))
    .map((role, order) => ({ ...role, bullet_count: Math.min(order === 0 ? 9 : 8, evidence.filter(e => e.id.startsWith(`experience:${role.experienceIndex}:`) && !e.id.endsWith(':technologies')).length) }));
}
export function validateResumeDraft(draft: ResumeDraft, candidate: Candidate, job: Job) {
  const evidence = resumeEvidence(candidate);
  const byId = new Map(evidence.map(e => [e.id, e]));
  const approvedFamilySkills = familyApprovedResumeSkills(candidate, job);
  if (approvedFamilySkills.length) byId.set('family:approved-jd-skills', { id: 'family:approved-jd-skills', kind: 'skill', label: 'Family skills', text: approvedFamilySkills.join(', '), skills: approvedFamilySkills });
  const candidateSkills = new Set(allowedResumeSkills(candidate).map(norm));
  const familySkills = new Set(familyApprovedResumeSkills(candidate, job).map(norm));
  const allowed = new Set([...candidateSkills, ...familySkills]);
  const heldQualifications = new Set([...allowed, ...(candidate.career?.certifications ?? []).map(c => norm(c.name))]);
  const knownRequirements = [...(job.jdProfile?.ats_keywords ?? []), ...(job.jdProfile?.adjacent_skills ?? []), ...(job.jdProfile?.mandatory_certifications ?? []), ...(job.jdProfile?.preferred_certifications ?? [])];
  const roles = resumeRoles(candidate, evidence);
  const errors: string[] = []; const warnings: string[] = []; const evidenceMap: ClaimEvidence[] = [];
  const seen = new Set<string>();
  const checkClaim = (item: ResumeDraft['summary'][number], section: 'summary' | 'experience', id: string, roleIndex?: number) => {
    const sources = item.sourceRefs.map(ref => byId.get(ref));
    if (sources.some(s => !s)) errors.push(`${id}: unknown evidence reference.`);
    if (roleIndex != null && item.sourceRefs.some(ref => !ref.startsWith(`experience:${roleIndex}:`))) errors.push(`${id}: evidence belongs to another employer.`);
    const sourceText = sources.filter(Boolean).map(s => s!.text).join('\n');
    const sourceSkills = new Set(sources.filter(Boolean).flatMap(s => s!.skills).map(norm));
    const familyClaimSkills = item.keywords.filter(keyword => familySkills.has(norm(keyword)) && !candidateSkills.has(norm(keyword)));
    for (const keyword of item.keywords) {
      if (!heldQualifications.has(norm(keyword))) errors.push(`${id}: qualification ${keyword} is not verified.`);
      const supportedBySource = sourceSkills.has(norm(keyword)) || norm(sourceText).includes(norm(keyword));
      if (!supportedBySource && !(section === 'summary' && familySkills.has(norm(keyword)))) errors.push(`${id}: sources do not support ${keyword}.`);
    }
    for (const term of knownRequirements) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (term && new RegExp(`(?<![\\w])${escaped}(?![\\w])`, 'i').test(item.text) && !heldQualifications.has(norm(term))) errors.push(`${id}: unconfirmed JD qualification ${term}.`);
      if (section === 'experience' && term && familySkills.has(norm(term)) && !candidateSkills.has(norm(term)) && !sourceSkills.has(norm(term)) && !norm(sourceText).includes(norm(term)) && new RegExp(`(?<![\\w])${escaped}(?![\\w])`, 'i').test(item.text)) errors.push(`${id}: employer evidence does not support ${term}.`);
    }
    const sourceNumbers = new Set(sourceText.match(/\b\d+(?:[.,]\d+)*(?:%|\+)?/g) ?? []);
    for (const number of item.text.match(/\b\d+(?:[.,]\d+)*(?:%|\+)?/g) ?? []) {
      if (!sourceNumbers.has(number)) errors.push(`${id}: metric ${number} is absent from the cited evidence.`);
    }
    if (/<\/?[a-z]|\*\*/i.test(item.text)) errors.push(`${id}: return plain text, not markup.`);
    if (section === 'experience') {
      if (seen.has(norm(item.text))) errors.push(`${id}: duplicate responsibility.`);
      seen.add(norm(item.text));
      const count = item.text.split(/\s+/).length;
      if (count < 20 || count > 35) warnings.push(`${id}: ${count} words (target 20–32).`);
    }
    evidenceMap.push({ claimId: id, section, outputText: item.text, sourceRef: [...item.sourceRefs, ...(familyClaimSkills.length ? ['family:approved-jd-skills'] : [])].join(', '), sourceText: [sourceText, familyClaimSkills.length ? `Family-approved JD skills: ${familyClaimSkills.join(', ')}` : ''].filter(Boolean).join('\n') });
  };
  draft.summary.forEach((c, i) => checkClaim(c, 'summary', `summary:${i}`));
  if (draft.summary.length < 5) warnings.push('Summary has fewer than five lines.');
  if (draft.experience.length !== roles.length || new Set(draft.experience.map(r => r.experienceIndex)).size !== roles.length) errors.push('Return each employer exactly once.');
  for (const role of roles) {
    const result = draft.experience.find(r => r.experienceIndex === role.experienceIndex);
    if (!result || result.bullets.length !== role.bullet_count) errors.push(`Experience ${role.experienceIndex}: expected ${role.bullet_count} evidenced bullets.`);
    result?.bullets.forEach((c, i) => checkClaim(c, 'experience', `experience:${role.experienceIndex}:${i}`, role.experienceIndex));
    if (role.bullet_count < (roles[0] === role ? 9 : 8)) warnings.push(`${role.company}: fewer verified facts than the requested bullet target.`);
  }
  const selected = draft.skillCategories.flatMap(c => c.skills);
  if (new Set(selected.map(norm)).size !== selected.length) errors.push('Duplicate technical skills.');
  for (const skill of selected) if (!allowed.has(norm(skill))) errors.push(`Unverified technical skill: ${skill}.`);
  if (draft.skillCategories.length < 6 || draft.skillCategories.some(c => c.skills.length < 4)) warnings.push('Skill category targets reduced; do not pad with unverified skills.');
  const supportedP1 = (job.jdProfile?.mandatory_skills ?? []).filter(s => allowed.has(norm(s)));
  for (const skill of supportedP1) if (!selected.some(s => norm(s) === norm(skill))) errors.push(`Include verified mandatory skill ${skill}.`);
  return { passed: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)], claimCount: evidenceMap.length, evidenceMap };
}
export async function writeResumeWithLLM(config: AIConfig, candidate: Candidate, job: Job, customStyle: string, prompt: WorkflowPrompt = defaultWorkflowPrompt('resume-generation')) {
  if (!job.jdProfile) throw new Error('Analyze the shared JD before generating.');
  const evidence = resumeEvidence(candidate);
  if (!evidence.length) throw new Error('Add candidate evidence before generating a resume.');
  const roles = resumeRoles(candidate, evidence);
  const familySkills = familyApprovedResumeSkills(candidate, job);
  const result = await structuredAI(config, 'grounded_resume', resumeDraftSchema, prompt.template + '\n\n' + OUTPUT_CONTRACT, {
    JD_PROFILE: job.jdProfile, target_role: job.targetRole || job.title, VERIFIED_EVIDENCE: [...evidence, ...(familySkills.length ? [{ id: 'family:approved-jd-skills', text: familySkills.join(', '), skills: familySkills }] : [])], ALLOWED_SKILLS: generationResumeSkills(candidate, job), FAMILY_APPROVED_SKILLS: familySkills,
    HELD_CERTIFICATIONS: (candidate.career?.certifications ?? []).map(c => ({ name: c.name, issuer: c.issuer })),
    roles: roles.map(r => ({ experienceIndex: r.experienceIndex, company: r.company, title: r.title, bullet_count: r.bullet_count })), custom_style: customStyle,
  }, 16000);
  const validation = validateResumeDraft(result.value, candidate, job);
  if (!validation.passed) {
    const fallback = groundedFallbackResume(candidate, job, validation.errors);
    return { ...fallback, usage: result.usage, promptVersion: RESUME_PROMPT_VERSION };
  }
  const draft = result.value;
  const base = groundedResumeContent(candidate, job, draft.skillCategories.flatMap(c => c.skills), draft.summary.map(s => s.text).join('\n'));
  const content: ResumeContent = { ...base.content, skillCategories: draft.skillCategories,
    education: (candidate.career?.education ?? []).map((record, index) => ({ record, index })).sort((a, b) => b.record.end.localeCompare(a.record.end) || b.record.start.localeCompare(a.record.start)).map(({ index }) => base.content.education[index]),
    highlights: [...new Set(draft.skillCategories.flatMap(c => c.skills))],
    experience: roles.map(role => ({ company: role.company, title: role.title, location: role.location, dates: [role.start, role.current ? 'Present' : role.end].filter(Boolean).join(' – '),
      bullets: draft.experience.find(r => r.experienceIndex === role.experienceIndex)!.bullets.map(b => b.text) })),
  };
  return { content, evidenceMap: [...validation.evidenceMap, ...base.evidenceMap.filter(e => e.section !== 'experience')],
    validation: { ...validation, warnings: [...validation.warnings, 'Review AI wording against the cited evidence before approving. Evidence references do not prove semantic accuracy.'] },
    usage: result.usage, gaps: draft.gaps, promptVersion: RESUME_PROMPT_VERSION, fallback: false, fallbackReasonCount: 0, rejectedDraftErrors: [] as string[] };
}

export function validateAIResumeEdit(content: ResumeContent, parent: ResumeContent, evidenceMap: ClaimEvidence[]) {
  const fixed = (value: ResumeContent) => JSON.stringify([value.name, value.contact, value.education, value.certifications, value.projects, value.experience.map(r => [r.company, r.title, r.location, r.dates])]);
  if (fixed(content) !== fixed(parent)) throw new Error('Update verified candidate records and regenerate to change employment, education or certifications.');
  const allowed = new Set(parent.skills.map(norm));
  if (content.skills.some(s => !allowed.has(norm(s))) || content.skillCategories?.flatMap(c => c.skills).some(s => !allowed.has(norm(s)))) throw new Error('Confirm new skills on the candidate and regenerate.');
  const mapped = new Set(evidenceMap.map(e => e.outputText));
  if (content.summary.split('\n').some(line => line.trim() && !mapped.has(line.trim())) || content.experience.flatMap(r => r.bullets).some(b => !mapped.has(b))) throw new Error('New wording needs evidence review. Update the candidate evidence and regenerate.');
}
