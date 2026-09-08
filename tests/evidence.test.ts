import { describe, expect, it } from 'vitest';
import { careerSchema } from '../lib/career';
import { deriveCandidateSkills, groundedResumeContent, careerEvidence, validateGrounding } from '../lib/evidence';
import type { Candidate, Job } from '../lib/types';

const career = careerSchema.parse({
  experience: [{ company: 'Acme', title: 'Platform Engineer', location: 'Seattle', start: '2021-01', end: '', current: true, responsibilities: 'Built AWS and Kubernetes platforms', achievements: 'Reduced deploy time by 40%', technologies: 'AWS, Kubernetes' }],
  education: [{ institution: 'State University', degree: 'BS', field: 'Computer Science', start: '2017-01', end: '2021-01' }],
  certifications: [{ name: 'AWS Solutions Architect', issuer: 'Amazon', start: '2023-01', end: '', url: 'https://example.com/cert' }],
  projects: [{ name: 'Delivery platform', contribution: 'Created Terraform modules', technologies: 'Terraform', outcomes: 'Improved reliability', url: 'https://github.com/acme/platform' }],
});

const candidate = { id: 'c1', email: 'john@example.com', firstName: 'John', lastName: 'Doe', name: 'John Doe', initials: 'JD', phone: '', headline: '', summary: '', location: 'Seattle', family: 'DevOps', status: 'Active', portalEnabled: true, skills: [], career, createdAt: '2026-01-01', updatedAt: '2026-01-02' } as Candidate;
const job = { id: 'j1', candidateId: 'c1', company: 'Acme', title: 'Senior Platform Engineer', location: 'Seattle', workType: 'Hybrid', salary: '', source: 'Manual', sourceUrl: 'https://example.com/j1', jdText: 'AWS Kubernetes Terraform platform operations', mandatorySkills: ['AWS', 'Kubernetes'], preferredSkills: ['Terraform'], targetRole: 'Senior Platform Engineer', targetLocation: 'Seattle', family: 'DevOps', status: 'Selected', matchScore: 90, discoveredAt: '2026-01-01', appliedAt: null, appliedResumeId: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' } as Job;

describe('resume evidence foundation', () => {
  it('turns career records into traceable candidate skills', () => {
    const units = careerEvidence(career);
    const skills = deriveCandidateSkills(career, ['AWS', 'Kubernetes', 'Terraform']);
    expect(units.some(unit => unit.id === 'experience:0:0')).toBe(true);
    expect(skills.map(skill => skill.name)).toEqual(expect.arrayContaining(['AWS', 'Kubernetes', 'Terraform']));
    expect(skills.find(skill => skill.name === 'AWS')?.evidenceRefs?.length).toBeGreaterThan(0);
  });

  it('generates experience, projects and a claim map from candidate evidence', () => {
    const result = groundedResumeContent(candidate, job, ['AWS', 'Kubernetes'], 'Evidence-backed summary');
    expect(result.content.experience[0]).toMatchObject({ company: 'Acme', title: 'Platform Engineer' });
    expect(result.content.projects?.[0]).toContain('Delivery platform');
    expect(validateGrounding(result.content, result.evidenceMap)).toMatchObject({ passed: true, claimCount: expect.any(Number) });
  });

  it('rejects edited claims that are not present in the evidence map', () => {
    const result = groundedResumeContent(candidate, job, ['AWS'], 'Summary');
    const edited = { ...result.content, experience: result.content.experience.map(role => ({ ...role, bullets: [...role.bullets, 'Invented production claim'] })) };
    expect(validateGrounding(edited, result.evidenceMap).passed).toBe(false);
  });
});
