import type { Candidate, Job } from './types';
import type { Career } from './career';

export function candidateRequiredFields(candidate: Partial<Candidate>): string[] {
  const missing: string[] = [];
  for (const [key, label] of [['firstName', 'First name'], ['lastName', 'Last name'], ['email', 'Email address'], ['phone', 'Phone'], ['location', 'Target location'], ['family', 'Job family']] as const)
    if (!String(candidate[key] ?? '').trim()) missing.push(label);
  if (candidate.email && !/^\S+@\S+\.\S+$/.test(candidate.email)) missing.push('Valid email address');
  return missing;
}

export function careerRequiredFields(career?: Career): string[] {
  const first = career?.experience?.[0];
  if (!first) return ['At least one employment record'];
  const missing: string[] = [];
  if (!first.company.trim()) missing.push('Experience company');
  if (!first.title.trim()) missing.push('Experience role title');
  if (!first.start.trim()) missing.push('Experience start date');
  if (!(first.responsibilities.trim() || first.achievements.trim())) missing.push('Experience responsibilities or achievements');
  return missing;
}

export function jobRequiredFields(job: Partial<Job>): string[] {
  const missing: string[] = [];
  if (!job.salary?.trim()) missing.push('Salary');
  if (!job.sourceUrl?.trim()) missing.push('Job URL');
  for (const [key, label] of [['company', 'Company'], ['title', 'Job title'], ['location', 'Job location'], ['workType', 'Work type'], ['family', 'Job family'], ['jdText', 'Complete job description']] as const)
    if (!String(job[key] ?? '').trim()) missing.push(label);
  return missing;
}
