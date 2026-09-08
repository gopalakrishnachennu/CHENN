import type { ApplicationStatus, CandidateSkill, JobFamily, SkillPlanItem } from '@/lib/types';

export const statusTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
  Selected: ['Pending', 'Applied', 'Failed'],
  Pending: ['Selected', 'Applied', 'Failed'],
  Applied: ['Interview', 'Rejected', 'Offer', 'Failed'],
  Interview: ['Applied', 'Rejected', 'Offer'],
  Rejected: ['Applied'],
  Offer: ['Interview'],
  Failed: ['Pending', 'Applied'],
};

export function canTransitionStatus(from: ApplicationStatus, to: ApplicationStatus) {
  return from === to || statusTransitions[from].includes(to);
}

export function normalizeSkill(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#.]/g, '');
}

const knownSkills = [
  'AWS', 'Azure', 'GCP', 'Terraform', 'Kubernetes', 'Docker', 'Jenkins', 'GitHub Actions',
  'Prometheus', 'Grafana', 'Python', 'Bash', 'Linux', 'Ansible', 'Argo CD', 'Helm',
  'JavaScript', 'TypeScript', 'React', 'Node.js', 'Java', 'Go', 'C#', '.NET', 'SQL',
  'Snowflake', 'Databricks', 'Spark', 'Kafka', 'Airflow', 'dbt', 'Salesforce', 'Apex',
  'Machine Learning', 'TensorFlow', 'PyTorch', 'MLOps', 'CI/CD', 'SRE', 'Observability',
];

export function extractSkillRequirements(jd: string, family?: JobFamily) {
  const text = jd.toLowerCase();
  const sentences = text.split(/(?<=[.!?;\n])\s*/).filter(Boolean);
  const candidates = [...knownSkills, ...(family?.skills ?? [])];
  const seen = new Set<string>();
  const found = candidates.filter((skill) => {
    const normalized = normalizeSkill(skill);
    if (!normalized || seen.has(normalized)) return false;
    const matched = text.includes(skill.toLowerCase()) || text.replace(/[^a-z0-9+#.]/g, '').includes(normalized);
    if (matched) seen.add(normalized);
    return matched;
  });

  const preferred: string[] = [];
  const mandatory: string[] = [];
  for (const skill of found) {
    const normalized = normalizeSkill(skill);
    const context = sentences.find((sentence) =>
      sentence.includes(skill.toLowerCase()) || sentence.replace(/[^a-z0-9+#.]/g, '').includes(normalized),
    ) ?? '';
    if (/preferred|nice to have|bonus|plus|desired/.test(context)) preferred.push(skill);
    else mandatory.push(skill);
  }
  return { mandatory, preferred };
}

export function buildSkillPlan(
  candidateSkills: CandidateSkill[],
  family: JobFamily | undefined,
  mandatory: string[],
  preferred: string[],
  options: { allowFamilyContext?: boolean; allowSupportingContext?: boolean } = {},
): SkillPlanItem[] {
  const profile = new Map(
    candidateSkills
      .filter((skill) => ['Profile', 'Career'].includes(skill.source) && skill.evidence.trim())
      .map((skill) => [normalizeSkill(skill.name), skill]),
  );
  const familySkills = new Set((family?.skills ?? []).map(normalizeSkill));
  const rows = [
    ...mandatory.map((name) => ({ name, required: true })),
    ...preferred.map((name) => ({ name, required: false })),
  ];

  return rows.map(({ name, required }) => {
    const candidateSkill = profile.get(normalizeSkill(name));
    if (candidateSkill) {
      return {
        name,
        required,
        source: 'Profile',
        detail: candidateSkill.evidence || `${candidateSkill.years} years · ${candidateSkill.proficiency}`,
      };
    }
    if (options.allowFamilyContext !== false && familySkills.has(normalizeSkill(name))) {
      return {
        name,
        required,
        source: 'JD + Family',
        detail: `Relevant to the approved ${family?.name ?? 'job'} family, but not candidate evidence; excluded from resume claims.`,
      };
    }
    if (!required && options.allowSupportingContext !== false) {
      return { name, required, source: 'Supporting', detail: 'Preferred JD context only; excluded from resume claims.' };
    }
    return { name, required, source: 'Missing', detail: 'No approved evidence or family relationship found.' };
  });
}

export function calculateMatch(plan: SkillPlanItem[]) {
  if (plan.length === 0) return 0;
  const total = plan.reduce((sum, item) => sum + (item.required ? 2 : 1), 0);
  // A family or JD relationship helps reviewers understand alignment, but it is
  // not evidence that this candidate owns the skill. Only profile-backed skills
  // count toward the displayed match score.
  const covered = plan.reduce((sum, item) => sum + (item.source === 'Profile' ? (item.required ? 2 : 1) : 0), 0);
  return Math.round((covered / total) * 100);
}
