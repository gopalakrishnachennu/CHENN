import type { Candidate, JobFamily } from './types';
import { careerEvidence } from './evidence';
import { JOB_FAMILY_KNOWLEDGE, type JobFamilyKnowledge, type JobSubFamilyProfile } from './job-family-profiles';

export type RequirementClass = 'Mandatory' | 'Required' | 'Preferred' | 'Supporting' | 'Inferred';
export type RequirementKind = 'skill' | 'platform' | 'tool' | 'methodology' | 'responsibility' | 'experience' | 'education' | 'certification' | 'authorization' | 'location' | 'clearance' | 'travel' | 'domain' | 'soft-skill';
export type JDRequirement = { id: string; text: string; canonical: string; kind: RequirementKind; classification: RequirementClass; explicit: boolean; confidence: number; importance: 'Critical' | 'High' | 'Medium' | 'Low'; atsWeight: number; frequency: number; suggestedSections: string[]; synonyms: string[]; reason: string };
export type AdjacentSkillPrediction = { skill: string; confidence: number; reason: string; triggers: string[]; verified: false };
export type CoverageDimension = { score: number; covered: string[]; gaps: string[]; target: number | null };
export type JDCoverage = { mandatory: CoverageDimension; required: CoverageDimension; preferred: CoverageDimension; overallJD: CoverageDimension; keyword: CoverageDimension; tool: CoverageDimension; responsibility: CoverageDimension; qualification: CoverageDimension; role: CoverageDimension; domain: CoverageDimension };
export type SkillPlacement = { skill: string; category: string; classification: RequirementClass; sections: Array<'Summary' | 'Technical Skills' | 'Current Experience' | 'Previous Experience' | 'Projects'>; occurrences: number; density: 'High' | 'Moderate' | 'Selective' | 'None'; recency: 'Current' | 'Previous' | 'Project' | 'Unverified'; repeatedAcrossRoles: boolean; overused: boolean; evidenceRefs: string[]; status: 'Verified' | 'Gap' | 'Unverified suggestion' };
export type ResponsibilityPlacement = { responsibility: string; experienceIndex: number | null; evidenceRefs: string[]; actionVocabulary: string[]; metricOpportunity: string; status: 'Supported' | 'Gap' };
export type ExperiencePlan = { experienceIndex: number; employer: string; originalTitle: string; roleRelevance: number; seniority: string; domain: string; technologies: string[]; responsibilitiesToEmphasize: string[]; targetBulletCount: number; jdSkills: string[] };
export type SkillCategoryPlan = { category: string; skills: string[] };
export type ResumeGenerationPlan = { displayTitle: string; originalTitle: string; sectionOrder: string[]; coverageTargets: { mandatory: number; required: number; preferred: number }; skillDistribution: SkillPlacement[]; skillCategories: SkillCategoryPlan[]; responsibilityDistribution: ResponsibilityPlacement[]; experiencePlans: ExperiencePlan[]; keywordGaps: string[]; overusedKeywords: string[]; qualificationConfirmations: string[]; metricOpportunities: string[]; bulletSpecification: string[]; futureATSChecks: string[]; guardrails: string[] };
export type JDAnalysis = {
  version: 'jd-intelligence-v1'; normalizedTitle: string; originalTitle: string; family: string; subFamily: string; familyConfidence: number; seniority: string; domain: string; industry: string; companyEnvironment: string[]; coreObjective: string; dayToDayResponsibilities: string[];
  requirements: JDRequirement[]; explicitSkills: string[]; inferredSkills: AdjacentSkillPrediction[]; atsSynonyms: Record<string, string[]>; coverage: JDCoverage; resumePlan: ResumeGenerationPlan;
};
export type StructuredJobRequirements = { responsibilities: string[]; education: string[]; certifications: string[]; minimumYears: number | null; authorization: string; clearance: string; travel: string; seniority: string };

const rows = (value: string) => value.split(/(?:\r?\n)+|(?<=[.!?;])\s+/).map(item => item.replace(/^[•·▪◦*\-–—\d.)\s]+/, '').trim()).filter(Boolean);
const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#.]/g, '');
const words = (value: string) => value.toLowerCase().split(/[^a-z0-9+#.]+/).filter(x => x.length > 2);
const unique = <T>(items: T[]) => [...new Set(items)];
const contains = (text: string, value: string) => !!norm(value) && (text.toLowerCase().includes(value.toLowerCase()) || norm(text).includes(norm(value)));

const GLOBAL_SYNONYMS: Record<string, string[]> = {
  AWS: ['Amazon Web Services'], Azure: ['Microsoft Azure'], 'Google Cloud': ['GCP', 'Google Cloud Platform'], Kubernetes: ['K8s'],
  'CI/CD': ['continuous integration', 'continuous delivery', 'continuous deployment', 'delivery pipeline'], Terraform: ['infrastructure as code', 'IaC'],
  PostgreSQL: ['Postgres', 'Aurora PostgreSQL'], 'Node.js': ['NodeJS', 'Node JS'], SRE: ['site reliability engineering'],
  Observability: ['monitoring', 'telemetry'], 'High Availability': ['HA', 'failover'], 'Backup and Recovery': ['backup/restore', 'disaster recovery', 'DR'],
  IAM: ['identity and access management'], 'API Design': ['REST API', 'RESTful services'],
};
const METHODOLOGIES = ['Agile', 'Scrum', 'Kanban', 'ITIL', 'GitOps', 'DevOps', 'SRE', 'Infrastructure as Code'];
const PLATFORMS = ['AWS', 'Azure', 'Google Cloud', 'Kubernetes', 'OpenShift', 'VMware', 'PostgreSQL', 'Oracle Database', 'SQL Server', 'MongoDB', 'Snowflake', 'Databricks'];

function classifyKnowledge(title: string, jd: string, knowledge: JobFamilyKnowledge[] = JOB_FAMILY_KNOWLEDGE) {
  const text = `${title} ${jd}`;
  const ranked = knowledge.flatMap(family => family.subFamilies.map(profile => {
    const titleHits = profile.roles.filter(role => contains(title, role)).length;
    const roleHits = profile.roles.filter(role => contains(text, role)).length;
    const skillHits = [...profile.skills, ...profile.tools].filter(skill => contains(text, skill) || (GLOBAL_SYNONYMS[skill] ?? []).some(alias => contains(text, alias))).length;
    const tokens = words(text); const responsibilityHits = profile.responsibilities.filter(item => words(item).filter(w => tokens.includes(w)).length >= 2).length;
    return { family, profile, score: titleHits * 10 + roleHits * 5 + skillHits * 2 + responsibilityHits };
  })).sort((a, b) => b.score - a.score);
  const best = ranked[0]; const second = ranked[1]?.score ?? 0;
  if (!best || !best.score) return { family: '', profile: null, confidence: 0 };
  return { family: best.family.family, profile: best.profile, confidence: Math.min(99, Math.round(55 + best.score * 2 + Math.max(0, best.score - second) * 2)) };
}

function requirementClass(row: string): RequirementClass {
  if (/\b(must|mandatory|essential|non[- ]negotiable)\b/i.test(row)) return 'Mandatory';
  if (/\b(required|requirement|minimum|at least|need(?:ed)?|should have)\b/i.test(row)) return 'Required';
  if (/\b(preferred|nice to have|bonus|plus|desired|ideally)\b/i.test(row)) return 'Preferred';
  return 'Supporting';
}
function requirementKind(row: string): RequirementKind {
  if (/\b(certification|certified|certificate|license)\b/i.test(row)) return 'certification';
  if (/\b(bachelor|master|ph\.?d|degree|education)\b/i.test(row)) return 'education';
  if (/\b(years?|yrs?)\b.*\bexperience\b|\bexperience\b.*\b(years?|yrs?)\b/i.test(row)) return 'experience';
  if (/\b(work authorization|authorized to work|visa|sponsorship|citizen|permanent resident)\b/i.test(row)) return 'authorization';
  if (/\b(location|onsite|on-site|hybrid|remote|relocat)\w*\b/i.test(row)) return 'location';
  if (/\b(clearance|public trust|secret|top secret|ts\/sci)\b/i.test(row)) return 'clearance';
  if (/\btravel\b|\d+%\s+travel/i.test(row)) return 'travel';
  if (/\b(communicat|collaborat|stakeholder|leadership|teamwork)\w*\b/i.test(row)) return 'soft-skill';
  return /\b(build|design|develop|lead|manage|operate|own|implement|maintain|deliver|create|support|administer|tune|automate|monitor|migrate|architect|optimize)\b/i.test(row) ? 'responsibility' : 'skill';
}
function makeRequirement(id: string, text: string, canonical: string, kind: RequirementKind, classification: RequirementClass, jd: string, synonyms: string[] = []): JDRequirement {
  const frequency = Math.max(1, [canonical, ...synonyms].reduce((total, term) => total + (norm(jd).split(norm(term)).length - 1), 0));
  const base = { Mandatory: 92, Required: 80, Preferred: 62, Supporting: 42, Inferred: 20 }[classification];
  const importance = classification === 'Mandatory' ? 'Critical' : classification === 'Required' ? 'High' : classification === 'Preferred' ? 'Medium' : 'Low';
  const suggestedSections = ['skill', 'tool', 'platform', 'methodology'].includes(kind) ? (classification === 'Mandatory' || classification === 'Required' ? ['Professional Summary', 'Technical Skills', 'Experience'] : ['Technical Skills', 'Experience']) : kind === 'responsibility' ? ['Experience'] : ['Qualifications'];
  return { id, text, canonical, kind, classification, explicit: true, confidence: 1, importance, atsWeight: Math.min(100, base + Math.min(8, frequency * 2)), frequency, suggestedSections, synonyms, reason: `${classification} language and JD context.` };
}
function yearsFrom(jd: string) { return [...jd.matchAll(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:(?:professional|hands[- ]on|relevant|technical)\s+)?experience/gi)].map(m => Number(m[1])).filter(Number.isFinite); }
function detectSeniority(title: string, jd: string, minimumYears: number | null) {
  const text = `${title} ${jd}`;
  if (/\b(chief|head|director|vp|vice president)\b/i.test(text)) return 'Leadership';
  if (/\b(principal|staff|architect)\b/i.test(text)) return 'Lead / Principal';
  if (/\b(lead|senior|sr\.?)(?!\s+vice)\b/i.test(text) || (minimumYears ?? 0) >= 7) return 'Senior';
  if (/\b(junior|jr\.?|entry[- ]level|associate|graduate)\b/i.test(text) || (minimumYears != null && minimumYears <= 2)) return 'Junior';
  return 'Mid';
}
function detectEnvironment(jd: string) { return unique(([['Startup', /\bstartup|early[- ]stage|founding\b/i], ['Enterprise', /\benterprise|large[- ]scale|global organization\b/i], ['Regulated', /\bregulated|compliance|sox|hipaa|pci|fedramp\b/i], ['SaaS', /\bsaas|multi[- ]tenant\b/i], ['High growth', /\bhigh[- ]growth|fast[- ]paced|scale[- ]up\b/i], ['Remote / distributed', /\bremote|distributed team\b/i]] as const).filter(([, p]) => p.test(jd)).map(([name]) => name)); }
function detectDomain(jd: string) { return ([['Fintech', /\bfintech|financial services|banking|payments|trading\b/i], ['Healthcare', /\bhealthcare|clinical|hipaa|patient\b/i], ['E-commerce', /\be-?commerce|retail|marketplace\b/i], ['Government', /\bgovernment|federal|fedramp|public sector\b/i], ['Cybersecurity', /\bsecurity|cybersecurity|infosec\b/i]] as Array<[string, RegExp]>).find(([, p]) => p.test(jd))?.[0] ?? 'General'; }

function candidateEvidence(candidate?: Candidate) {
  if (!candidate) return [] as Array<{ ref: string; text: string }>;
  return [...careerEvidence(candidate.career).map(unit => ({ ref: unit.id, text: `${unit.label} ${unit.text} ${unit.skills.join(' ')}` })), ...(candidate.skills ?? []).filter(skill => ['Profile', 'Career'].includes(skill.source)).map(skill => ({ ref: skill.evidenceRefs?.[0] ?? `skill:${skill.id}`, text: `${skill.name} ${skill.evidence}` }))];
}
function refsFor(term: string, evidence: Array<{ ref: string; text: string }>, synonyms: string[] = []) { return unique(evidence.filter(item => [term, ...synonyms].some(value => contains(item.text, value))).map(item => item.ref)); }
function coverageDimension(items: JDRequirement[], evidence: Array<{ ref: string; text: string }>, target: number | null): CoverageDimension {
  const covered = items.filter(item => refsFor(item.canonical, evidence, item.synonyms).length).map(item => item.canonical);
  const gaps = items.filter(item => !refsFor(item.canonical, evidence, item.synonyms).length).map(item => item.canonical);
  const total = items.reduce((sum, item) => sum + item.atsWeight, 0); const hit = items.filter(item => covered.includes(item.canonical)).reduce((sum, item) => sum + item.atsWeight, 0);
  return { score: total ? Math.round(hit / total * 100) : 100, covered: unique(covered), gaps: unique(gaps), target };
}

function extractJD(input: { title: string; jdText: string; company?: string; family?: string }, knowledge: JobFamilyKnowledge[]) {
  const title = input.title.trim(); const jd = input.jdText.trim(); const jdRows = rows(jd);
  const classified = classifyKnowledge(title, jd, knowledge); const profile = classified.profile;
  const synonyms = { ...GLOBAL_SYNONYMS, ...(profile?.terminology ?? {}) };
  const knownTerms = unique(profile ? [...Object.keys(GLOBAL_SYNONYMS), ...METHODOLOGIES, ...PLATFORMS, ...profile.skills, ...profile.tools, ...Object.keys(profile.terminology)] : [...Object.keys(GLOBAL_SYNONYMS), ...METHODOLOGIES, ...PLATFORMS]);
  const extracted: JDRequirement[] = [];
  for (const [index, row] of jdRows.entries()) {
    const classification = requirementClass(row); const kind = requirementKind(row);
    const found = knownTerms.filter(term => contains(row, term) || (synonyms[term] ?? []).some(alias => contains(row, alias)));
    for (const term of found) extracted.push(makeRequirement(`r${index}-${norm(term)}`, row, term, profile?.tools.includes(term) ? 'tool' : METHODOLOGIES.includes(term) ? 'methodology' : PLATFORMS.includes(term) ? 'platform' : 'skill', classification, jd, synonyms[term] ?? []));
    if (!['skill', 'tool', 'responsibility'].includes(kind)) extracted.push(makeRequirement(`r${index}-${kind}`, row, row, kind, classification, jd));
    if (kind === 'responsibility') extracted.push(makeRequirement(`r${index}-responsibility`, row, row, 'responsibility', classification, jd));
  }
  const priority: Record<RequirementClass, number> = { Mandatory: 5, Required: 4, Preferred: 3, Supporting: 2, Inferred: 1 };
  const requirementMap = new Map<string, JDRequirement>();
  for (const item of extracted) {
    const key = `${norm(item.canonical)}:${item.kind}`; const current = requirementMap.get(key);
    if (!current || priority[item.classification] > priority[current.classification]) requirementMap.set(key, item);
  }
  const requirements = [...requirementMap.values()];
  const explicitSkills = unique(requirements.filter(item => ['skill', 'platform', 'tool', 'methodology'].includes(item.kind)).map(item => item.canonical));
  const inferredSkills: AdjacentSkillPrediction[] = (profile?.adjacentSkills ?? []).filter(item => !explicitSkills.some(skill => norm(skill) === norm(item.skill)) && item.when.some(trigger => contains(jd, trigger))).map(item => ({ skill: item.skill, confidence: item.confidence, reason: item.reason, triggers: item.when.filter(trigger => contains(jd, trigger)), verified: false }));
  const years = yearsFrom(jd); const minimumYears = years.length ? Math.max(...years) : null; const seniority = detectSeniority(title, jd, minimumYears);
  return { classified, profile, synonyms, requirements, explicitSkills, inferredSkills, minimumYears, seniority };
}

export function analyzeJD(input: { title: string; jdText: string; company?: string; family?: string }, candidate?: Candidate, knowledge: JobFamilyKnowledge[] = JOB_FAMILY_KNOWLEDGE, cached?: JDAnalysis): JDAnalysis {
  const title = input.title.trim(); const jd = input.jdText.trim();
  const jdRows = cached ? [] : rows(jd);
  const { classified, profile, synonyms, requirements, explicitSkills, inferredSkills, minimumYears, seniority } = cached ? {
    classified: { family: cached.family, confidence: cached.familyConfidence },
    profile: knowledge.flatMap(f => f.subFamilies).find(p => p.name === cached.subFamily) ?? null,
    synonyms: cached.atsSynonyms, requirements: cached.requirements,
    explicitSkills: cached.explicitSkills, inferredSkills: cached.inferredSkills,
    minimumYears: null, seniority: cached.seniority,
  } : extractJD(input, knowledge);
  const evidence = candidateEvidence(candidate); const byClass = (classification: RequirementClass) => requirements.filter(item => item.classification === classification);
  const tools = requirements.filter(item => item.kind === 'tool'); const responsibilities = requirements.filter(item => item.kind === 'responsibility'); const qualifications = requirements.filter(item => ['experience', 'education', 'certification', 'authorization', 'location', 'clearance', 'travel'].includes(item.kind));
  const keywords = requirements.filter(item => ['skill', 'platform', 'tool', 'methodology', 'responsibility'].includes(item.kind)); const domain = cached?.domain ?? detectDomain(jd);
  const roleItem = makeRequirement('role', title, title, 'responsibility', 'Required', jd); const domainItems = domain === 'General' ? [] : [makeRequirement('domain', domain, domain, 'domain', 'Supporting', jd)];
  const coverage: JDCoverage = { mandatory: coverageDimension(byClass('Mandatory'), evidence, 95), required: coverageDimension(byClass('Required'), evidence, 80), preferred: coverageDimension(byClass('Preferred'), evidence, 65), overallJD: coverageDimension(requirements, evidence, null), keyword: coverageDimension(keywords, evidence, null), tool: coverageDimension(tools, evidence, null), responsibility: coverageDimension(responsibilities, evidence, null), qualification: coverageDimension(qualifications, evidence, null), role: coverageDimension([roleItem], evidence, null), domain: coverageDimension(domainItems, evidence, null) };
  const seniorityKey = seniority.startsWith('Lead') || seniority === 'Leadership' ? 'Lead' : seniority; const actionVocabulary = profile?.seniority[seniorityKey] ?? profile?.seniority.Mid ?? ['build', 'deliver', 'improve'];
  const experienceCount = candidate?.career?.experience.length ?? 0;
  const responsibilityDistribution: ResponsibilityPlacement[] = responsibilities.slice(0, 20).map(item => { const refs = refsFor(item.canonical, evidence, item.synonyms); const ref = refs.find(x => x.startsWith('experience:')); const index = ref ? Number(ref.split(':')[1]) : null; return { responsibility: item.text, experienceIndex: Number.isFinite(index) ? index : experienceCount ? 0 : null, evidenceRefs: refs, actionVocabulary, metricOpportunity: metricOpportunity(item.text), status: refs.length ? 'Supported' : 'Gap' }; });
  const skillDistribution: SkillPlacement[] = requirements.filter(item => ['skill', 'platform', 'tool', 'methodology'].includes(item.kind)).map(item => { const refs = refsFor(item.canonical, evidence, item.synonyms); const sections: SkillPlacement['sections'] = ['Technical Skills']; if (refs.length && item.atsWeight >= 80) sections.unshift('Summary'); if (refs.some(ref => /^experience:0:/.test(ref))) sections.push('Current Experience'); if (refs.some(ref => /^experience:[1-9]\d*:/.test(ref))) sections.push('Previous Experience'); if (refs.some(ref => ref.startsWith('project:'))) sections.push('Projects'); const occurrences = item.atsWeight >= 80 ? Math.min(3, Math.max(2, item.frequency)) : 1; return { skill: item.canonical, category: skillCategory(item.canonical, item.kind), classification: item.classification, sections: unique(sections), occurrences, density: item.atsWeight >= 90 ? 'High' : item.atsWeight >= 60 ? 'Moderate' : 'Selective', recency: refs.some(ref => /^experience:0:/.test(ref)) ? 'Current' : refs.some(ref => /^experience:/.test(ref)) ? 'Previous' : refs.some(ref => ref.startsWith('project:')) ? 'Project' : 'Unverified', repeatedAcrossRoles: new Set(refs.filter(ref => ref.startsWith('experience:')).map(ref => ref.split(':')[1])).size > 1, overused: item.frequency > 5, evidenceRefs: refs, status: refs.length ? 'Verified' : 'Gap' }; });
  for (const inferred of inferredSkills) skillDistribution.push({ skill: inferred.skill, category: skillCategory(inferred.skill, 'tool'), classification: 'Inferred', sections: ['Technical Skills'], occurrences: 0, density: 'None', recency: 'Unverified', repeatedAcrossRoles: false, overused: false, evidenceRefs: [], status: 'Unverified suggestion' });
  const skillCategories = [...new Set(skillDistribution.map(item => item.category))].map(category => ({ category, skills: skillDistribution.filter(item => item.category === category).sort((a, b) => ({ Mandatory: 5, Required: 4, Preferred: 3, Supporting: 2, Inferred: 1 }[b.classification] - { Mandatory: 5, Required: 4, Preferred: 3, Supporting: 2, Inferred: 1 }[a.classification])).map(item => item.skill) }));
  const experiencePlans: ExperiencePlan[] = (candidate?.career?.experience ?? []).map((experience, experienceIndex) => { const unitText = `${experience.title} ${experience.responsibilities} ${experience.achievements} ${experience.technologies}`; const matchingSkills = explicitSkills.filter(skill => contains(unitText, skill)); const matchingResponsibilities = responsibilities.filter(item => words(item.text).filter(word => words(unitText).includes(word)).length >= 2).map(item => item.text); const roleOverlap = words(`${title} ${profile?.roles.join(' ') ?? ''}`).filter(word => words(experience.title).includes(word)).length; return { experienceIndex, employer: experience.company, originalTitle: experience.title, roleRelevance: Math.min(100, roleOverlap * 20 + matchingSkills.length * 10 + matchingResponsibilities.length * 10), seniority: detectSeniority(experience.title, unitText, null), domain, technologies: unique(experience.technologies.split(/[,;|\n]/).map(x => x.trim()).filter(Boolean)), responsibilitiesToEmphasize: matchingResponsibilities.slice(0, experienceIndex === 0 ? 5 : 3), targetBulletCount: experienceIndex === 0 ? 9 : 8, jdSkills: matchingSkills }; });
  const qualificationConfirmations = unique(qualifications.filter(item => !refsFor(item.canonical, evidence, item.synonyms).length).map(item => `${item.classification}: confirm ${item.text}`));
  const metricOpportunities = unique(responsibilityDistribution.map(item => item.metricOpportunity)); const displayTitle = normalizeDisplayTitle(title);
  return { version: 'jd-intelligence-v1', normalizedTitle: displayTitle, originalTitle: title, family: input.family?.trim() || classified.family || 'Custom / needs review', subFamily: profile?.name ?? 'Unclassified', familyConfidence: classified.confidence, seniority, domain, industry: domain, companyEnvironment: cached?.companyEnvironment ?? detectEnvironment(jd), coreObjective: cached?.coreObjective ?? responsibilities[0]?.text ?? jdRows[0] ?? title, dayToDayResponsibilities: unique(responsibilities.map(item => item.text)).slice(0, 20), requirements, explicitSkills, inferredSkills, atsSynonyms: Object.fromEntries(explicitSkills.filter(skill => synonyms[skill]?.length).map(skill => [skill, synonyms[skill]])), coverage, resumePlan: { displayTitle, originalTitle: title, sectionOrder: planSectionOrder(candidate, profile), coverageTargets: { mandatory: 95, required: 80, preferred: 65 }, skillDistribution, skillCategories, responsibilityDistribution, experiencePlans, keywordGaps: unique(skillDistribution.filter(item => item.status === 'Gap').map(item => item.skill)), overusedKeywords: unique(skillDistribution.filter(item => item.overused).map(item => item.skill)), qualificationConfirmations, metricOpportunities, bulletSpecification: ['Action', 'Technology', 'Responsibility', 'Context', 'Impact'], futureATSChecks: ['Standard headings', 'No parsing-hostile tables or text boxes', 'Simple dates and readable contact information', 'Standard fonts and consistent chronology', 'Natural keyword distribution without excessive repetition', 'First 10-second readability and recent-experience relevance'], guardrails: ['Use only candidate-verified evidence for resume claims.', 'Keep inferred skills marked unverified until confirmed.', 'Preserve employers, official titles, dates, degrees, certifications, licenses, and metrics exactly.', 'Do not invent numeric impact; request metrics where an opportunity is identified.', 'Avoid identical bullets across roles.'] } };
}

function metricOpportunity(text: string) {
  if (/\b(performance|latency|speed|optimi[sz])\b/i.test(text)) return 'Confirm before/after performance or latency impact.';
  if (/\b(reliab|availability|incident|downtime|slo|sla)\b/i.test(text)) return 'Confirm availability, incident, recovery-time, or toil impact.';
  if (/\b(cost|budget|spend|efficien)\b/i.test(text)) return 'Confirm cost or efficiency impact.';
  if (/\b(migrat|deploy|release|automat)\b/i.test(text)) return 'Confirm scale, duration, frequency, or time-saved impact.';
  return 'Confirm scope, scale, frequency, or stakeholder impact.';
}
function normalizeDisplayTitle(title: string) { return title.replace(/\bSr(?:\.|\b)/gi, 'Senior').replace(/\bJr(?:\.|\b)/gi, 'Junior').replace(/\bSRE\b/g, 'Site Reliability Engineer').replace(/\s+/g, ' ').trim(); }
function skillCategory(skill: string, kind: RequirementKind) { if (kind === 'methodology') return 'Methods'; if (/postgres|mysql|sql server|oracle|mongo|database|snowflake/i.test(skill)) return 'Databases'; if (/aws|azure|google cloud|cloud/i.test(skill)) return 'Cloud'; if (/terraform|ansible|infrastructure|packer/i.test(skill)) return 'Infrastructure & Automation'; if (/jenkins|github actions|gitlab|ci\/cd|argo/i.test(skill)) return 'CI/CD'; if (/kubernetes|docker|helm|container/i.test(skill)) return 'Containers'; if (/prometheus|grafana|datadog|observability|telemetry|splunk/i.test(skill)) return 'Monitoring & Observability'; if (/security|iam|vault/i.test(skill)) return 'Security'; if (/python|java|javascript|typescript|go|bash|powershell/i.test(skill)) return 'Programming'; return kind === 'platform' ? 'Platforms' : kind === 'tool' ? 'Tools' : 'Technical Skills'; }
function planSectionOrder(candidate: Candidate | undefined, profile: JobSubFamilyProfile | null) { const order = ['Professional Summary', 'Technical Skills', 'Professional Experience']; if (candidate?.career?.projects.length) order.push('Relevant Projects'); if (candidate?.career?.certifications.length || profile?.skills.some(skill => /security|cloud/i.test(skill))) order.push('Certifications'); order.push('Education'); return order; }

export function extractStructuredRequirements(jd: string): StructuredJobRequirements {
  const jdRows = rows(jd); const first = (pattern: RegExp) => jdRows.find(row => pattern.test(row)) ?? ''; const years = yearsFrom(jd); const minimumYears = years.length ? Math.max(...years) : null;
  return { responsibilities: jdRows.filter(row => requirementKind(row) === 'responsibility').slice(0, 20), education: jdRows.filter(row => requirementKind(row) === 'education').slice(0, 8), certifications: jdRows.filter(row => requirementKind(row) === 'certification').slice(0, 8), minimumYears, authorization: first(/\b(work authorization|authorized to work|visa|sponsorship|citizen|permanent resident)\b/i), clearance: first(/\b(clearance|public trust|secret|top secret|ts\/sci)\b/i), travel: first(/\btravel\b|\d+%\s+travel/i), seniority: detectSeniority('', jd, minimumYears) };
}

export function classifyJobFamily(input: { title?: unknown; role?: unknown; jdText?: unknown; description?: unknown }, families: JobFamily[]) {
  const title = String(input.title ?? input.role ?? ''); const jd = String(input.jdText ?? input.description ?? ''); const known = classifyKnowledge(title, jd);
  const configured = families.filter(family => family.active).map(family => ({ family, score: family.roles.filter(role => contains(`${title} ${jd}`, role)).length * 5 + family.skills.filter(skill => contains(jd, skill)).length })).sort((a, b) => b.score - a.score)[0];
  if (configured?.score) return { family: configured.family.name, confidence: Math.min(99, 60 + configured.score * 6) };
  const compatible = families.find(family => norm(family.name) === norm(known.family) || contains(known.family, family.name) || contains(family.name, known.family));
  return compatible ? { family: compatible.name, confidence: known.confidence } : { family: '', confidence: 0 };
}
