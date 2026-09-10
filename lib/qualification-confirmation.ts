import { z } from 'zod';
import { emptyCareer } from './career';
import type { Candidate } from './types';

export const confirmationSchema = z.object({
  kind: z.enum(['skill', 'certification']), name: z.string().trim().min(1).max(150),
  evidence: z.string().trim().max(3000).default(''), issuer: z.string().trim().max(150).default(''),
  experienceIndex: z.number().int().min(0).nullable().default(null),
}).strict().refine(v => v.kind !== 'certification' || !!v.issuer, 'Enter the certification issuer.');
export function confirmQualifications(candidate: Candidate, input: unknown, actor: string, timestamp: string) {
  const items = z.array(confirmationSchema).min(1).max(50).parse(input);
  const career = structuredClone(candidate.career ?? emptyCareer());
  const skills = [...(candidate.skills ?? [])];
  const confirmations = [...(candidate.qualificationConfirmations ?? [])];
  for (const item of items) {
    if (item.experienceIndex != null && !career.experience[item.experienceIndex]) throw new Error('Choose an existing employment record.');
    if (item.kind === 'skill') {
      const existing = skills.find(s => s.name.toLowerCase() === item.name.toLowerCase());
      const skill = { id: existing?.id ?? crypto.randomUUID(), name: item.name, evidence: item.evidence, proficiency: existing?.proficiency ?? 'Confirmed', years: existing?.years ?? 0, source: 'Profile' };
      if (existing) skills[skills.indexOf(existing)] = skill; else skills.push(skill);
      if (item.experienceIndex != null) {
        const role = career.experience[item.experienceIndex];
        role.technologies = [...new Set([...role.technologies.split(/[,\n]/).map(v => v.trim()).filter(Boolean), item.name])].join(', ');
        role.responsibilities = [role.responsibilities, item.evidence].filter(Boolean).join('\n');
      }
    } else if (!career.certifications.some(c => c.name.toLowerCase() === item.name.toLowerCase() && c.issuer.toLowerCase() === item.issuer.toLowerCase())) {
      career.certifications.push({ name: item.name, issuer: item.issuer, start: '', end: '', url: '' });
    }
    confirmations.push({ ...item, confirmedBy: actor, confirmedAt: timestamp });
  }
  return { career, skills, qualificationConfirmations: confirmations, updatedAt: timestamp };
}
