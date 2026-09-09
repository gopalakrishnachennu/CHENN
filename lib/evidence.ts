import type { Career } from './career';
import type {
  Candidate,
  CandidateSkill,
  ClaimEvidence,
  Job,
  ResumeContent,
} from './types';

export type EvidenceUnit = {
  id: string;
  kind: 'experience' | 'project' | 'certification' | 'education';
  label: string;
  text: string;
  skills: string[];
};

const lines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((item) => item.replace(/^[•·▪◦*-]\s*/, '').trim())
    .filter(Boolean);

const skills = (value: string) =>
  [...new Set(value.split(/[,;|\n]|\s\/\s/).map((item) => item.trim()).filter(Boolean))];

const normalized = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9+#.]/g, '');

const tokens = (value: string) =>
  new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((token) => token.length > 2),
  );

export function careerEvidence(career?: Career): EvidenceUnit[] {
  if (!career) return [];
  const units: EvidenceUnit[] = [];
  career.experience.forEach((role, roleIndex) => {
    const roleSkills = skills(role.technologies);
    [...lines(role.responsibilities), ...lines(role.achievements)].forEach(
      (text, lineIndex) =>
        units.push({
          id: `experience:${roleIndex}:${lineIndex}`,
          kind: 'experience',
          label: `${role.title} at ${role.company}`,
          text,
          skills: roleSkills,
        }),
    );
    if (roleSkills.length)
      units.push({
        id: `experience:${roleIndex}:technologies`,
        kind: 'experience',
        label: `${role.title} at ${role.company}`,
        text: `Technologies: ${roleSkills.join(', ')}`,
        skills: roleSkills,
      });
  });
  career.projects.forEach((project, projectIndex) => {
    const projectSkills = skills(project.technologies);
    [...lines(project.contribution), ...lines(project.outcomes)].forEach(
      (text, lineIndex) =>
        units.push({
          id: `project:${projectIndex}:${lineIndex}`,
          kind: 'project',
          label: project.name,
          text,
          skills: projectSkills,
        }),
    );
    if (projectSkills.length)
      units.push({
        id: `project:${projectIndex}:technologies`,
        kind: 'project',
        label: project.name,
        text: `Technologies: ${projectSkills.join(', ')}`,
        skills: projectSkills,
      });
  });
  career.certifications.forEach((certificate, index) =>
    units.push({
      id: `certification:${index}`,
      kind: 'certification',
      label: certificate.name,
      text: [certificate.name, certificate.issuer].filter(Boolean).join(' — '),
      skills: [certificate.name],
    }),
  );
  career.education.forEach((education, index) =>
    units.push({
      id: `education:${index}`,
      kind: 'education',
      label: education.institution,
      text: [education.degree, education.field].filter(Boolean).join(' in '),
      skills: [],
    }),
  );
  return units;
}

export function evidenceText(candidate: Candidate) {
  return careerEvidence(candidate.career)
    .map((unit) => `[${unit.id}] ${unit.label}: ${unit.text}`)
    .join('\n');
}

export function deriveCandidateSkills(
  career: Career,
  taxonomySkills: string[] = [],
  existing: CandidateSkill[] = [],
): CandidateSkill[] {
  const units = careerEvidence(career);
  const explicit = new Set(units.flatMap((unit) => unit.skills).filter(Boolean));
  const evidence = units.map((unit) => unit.text).join(' ');
  for (const skill of taxonomySkills) {
    if (normalized(skill) && normalized(evidence).includes(normalized(skill)))
      explicit.add(skill);
  }
  const retained = existing.filter((item) => item.source !== 'Career');
  const derived = [...explicit].map((name) => {
    const refs = units
      .filter(
        (unit) =>
          unit.skills.some((skill) => normalized(skill) === normalized(name)) ||
          normalized(unit.text).includes(normalized(name)),
      )
      .map((unit) => unit.id);
    return {
      id: `career-${normalized(name)}`,
      name,
      proficiency: 'Evidence verified',
      years: 0,
      evidence: refs
        .map((ref) => units.find((unit) => unit.id === ref)?.label)
        .filter(Boolean)
        .join('; '),
      evidenceRefs: refs,
      source: 'Career',
    } satisfies CandidateSkill;
  });
  const result = new Map<string, CandidateSkill>();
  for (const item of [...retained, ...derived]) result.set(normalized(item.name), item);
  return [...result.values()];
}

function relevance(text: string, job: Job) {
  if (job.jdProfile) {
    const source = tokens(text);
    return Object.entries(job.jdProfile.priority_keywords).reduce((score, [priority, terms]) => {
      const weight = { P1: 8, P2: 4, P3: 2, P4: 1 }[priority] ?? 1;
      return score + terms.reduce((sum, term) => {
        const keyword = [...tokens(term)];
        return sum + (keyword.length && keyword.every(token => source.has(token)) ? weight : 0);
      }, 0);
    }, 0);
  }
  const target = tokens(
    `${job.title} ${job.targetRole} ${job.jdText} ${job.mandatorySkills.join(' ')} ${job.preferredSkills.join(' ')}`,
  );
  return [...tokens(text)].filter((token) => target.has(token)).length;
}

export function groundedResumeContent(
  candidate: Candidate,
  job: Job,
  selectedSkills: string[],
  summary: string,
): { content: ResumeContent; evidenceMap: ClaimEvidence[] } {
  const units = careerEvidence(candidate.career);
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const career = candidate.career;
  const evidenceMap: ClaimEvidence[] = [];
  const usedBullets = new Set<string>();
  const experience = (career?.experience ?? []).map((role, roleIndex) => ({ role, roleIndex })).sort((a, b) => Number(b.role.current) - Number(a.role.current) || b.role.start.localeCompare(a.role.start)).map(({ role, roleIndex }, chronologicalIndex) => {
    const roleUnits = units
      .filter((unit) => unit.id.startsWith(`experience:${roleIndex}:`))
      .sort((a, b) => relevance(b.text, job) - relevance(a.text, job))
      .filter((unit, index, all) => all.findIndex(other => other.text.toLowerCase().trim() === unit.text.toLowerCase().trim()) === index)
      .filter(unit => !usedBullets.has(unit.text.toLowerCase().trim()))
      .slice(0, chronologicalIndex === 0 ? 9 : 8);
    const bullets = roleUnits.map((unit, bulletIndex) => {
      usedBullets.add(unit.text.toLowerCase().trim());
      evidenceMap.push({
        claimId: `experience:${roleIndex}:bullet:${bulletIndex}`,
        section: 'experience',
        outputText: unit.text,
        sourceRef: unit.id,
        sourceText: unit.text,
      });
      return unit.text;
    });
    return {
      company: role.company,
      title: role.title,
      location: role.location,
      dates: [role.start, role.current ? 'Present' : role.end]
        .filter(Boolean)
        .join(' – '),
      bullets,
    };
  });
  const content: ResumeContent = {
    name: candidate.name,
    headline: job.targetRole || job.title,
    contact: [candidate.email, candidate.phone, candidate.location]
      .filter(Boolean)
      .join(' · '),
    summary,
    skills: selectedSkills,
    experience,
    education: (career?.education ?? []).map((item) =>
      [
        item.institution,
        item.degree,
        item.field,
        [item.start, item.end].filter(Boolean).join(' – '),
      ]
        .filter(Boolean)
        .join(' · '),
    ),
    certifications: (career?.certifications ?? []).map((item) =>
      [
        item.name,
        item.issuer,
        item.start && `Issued ${item.start}`,
        item.end && `Expires ${item.end}`,
        item.url,
      ]
        .filter(Boolean)
        .join(' · '),
    ),
    projects: (career?.projects ?? [])
      .map((project, projectIndex) => {
        const projectUnits = units
          .filter((unit) => unit.id.startsWith(`project:${projectIndex}:`))
          .sort((a, b) => relevance(b.text, job) - relevance(a.text, job));
        const text = [
          project.name,
          ...projectUnits.map((unit) => unit.text),
          project.url,
        ]
          .filter(Boolean)
          .join(' · ');
        projectUnits.forEach((unit, unitIndex) =>
          evidenceMap.push({
            claimId: `project:${projectIndex}:${unitIndex}`,
            section: 'projects',
            outputText: unit.text,
            sourceRef: unit.id,
            sourceText: byId.get(unit.id)?.text ?? unit.text,
          }),
        );
        return text;
      }),
  };
  return { content, evidenceMap };
}

export function validateGrounding(
  content: ResumeContent,
  evidenceMap: ClaimEvidence[],
) {
  const errors: string[] = [];
  const mapped = new Set(evidenceMap.map((item) => item.outputText.trim()));
  for (const role of content.experience)
    for (const bullet of role.bullets)
      if (!mapped.has(bullet.trim())) errors.push(`Unmapped experience claim: ${bullet}`);
  return {
    passed: errors.length === 0,
    errors,
    warnings: content.skills.length ? [] : ['No JD-relevant verified skills were found.'],
    claimCount: evidenceMap.length,
  };
}
