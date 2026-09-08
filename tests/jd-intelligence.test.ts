import { describe, expect, it } from 'vitest';
import { analyzeJD } from '../lib/jd-intelligence';
import type { Candidate } from '../lib/types';

const candidate = {
  id: 'candidate-1', email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe', name: 'Jane Doe', initials: 'JD', phone: '555-0101', headline: 'Senior Database Administrator', summary: '', location: 'New York', family: 'Database Engineering', status: 'Active', portalEnabled: true, createdAt: '2026-01-01', updatedAt: '2026-01-01',
  skills: [
    { id: 'postgres', name: 'PostgreSQL', proficiency: 'Advanced', years: 8, evidence: 'Operated production Postgres platforms', source: 'Career' },
    { id: 'sql', name: 'SQL', proficiency: 'Advanced', years: 8, evidence: 'Tuned SQL queries', source: 'Career' },
  ],
  career: {
    experience: [{ company: 'DataCo', title: 'Database Administrator', location: 'New York', start: '2018-01', end: '', current: true, responsibilities: 'Administered PostgreSQL production databases\nDesigned backup and recovery procedures', achievements: 'Improved database reliability', technologies: 'PostgreSQL, SQL' }],
    education: [{ institution: 'State University', degree: 'Bachelor of Science', field: 'Computer Science', start: '2010-09', end: '2014-05' }], certifications: [], projects: [],
  },
} satisfies Candidate;

const postgresJD = `Senior PostgreSQL DBA
You must administer PostgreSQL and design high availability for a regulated financial services platform.
At least 7 years of experience is required.
Backup and recovery experience is required.
Patroni is preferred; pgBackRest is a nice to have.
AWS experience is desired.
Bachelor's degree in Computer Science required.
Lead database migrations and mentor engineers.`;

describe('micro-level JD intelligence', () => {
  it('classifies a full JD into family, sub-family, seniority, domain, and environment', () => {
    const result = analyzeJD({ title: 'Sr. PostgreSQL DBA', jdText: postgresJD }, candidate);
    expect(result).toMatchObject({ version: 'jd-intelligence-v1', normalizedTitle: 'Senior PostgreSQL DBA', family: 'Database Engineering', subFamily: 'PostgreSQL DBA', seniority: 'Senior', domain: 'Fintech' });
    expect(result.companyEnvironment).toContain('Regulated');
    expect(result.dayToDayResponsibilities.some(item => item.includes('migrations'))).toBe(true);
  });

  it('separates mandatory, required, preferred, and supporting requirements', () => {
    const result = analyzeJD({ title: 'Senior PostgreSQL DBA', jdText: postgresJD }, candidate);
    expect(result.requirements.find(item => item.canonical === 'PostgreSQL')?.classification).toBe('Mandatory');
    expect(result.requirements.find(item => item.kind === 'experience')?.classification).toBe('Required');
    expect(result.requirements.find(item => item.canonical === 'Patroni')?.classification).toBe('Preferred');
    expect(result.requirements.find(item => item.canonical === 'AWS')?.classification).toBe('Preferred');
  });

  it('keeps inferred adjacent skills separate, reasoned, and explicitly unverified', () => {
    const result = analyzeJD({ title: 'DevOps Engineer', jdText: 'Must operate Kubernetes and Linux. Build CI/CD pipelines.' });
    expect(result.explicitSkills).toEqual(expect.arrayContaining(['Kubernetes', 'Linux', 'CI/CD']));
    expect(result.inferredSkills).toEqual(expect.arrayContaining([expect.objectContaining({ skill: 'Helm', verified: false, confidence: expect.any(Number), reason: expect.any(String) })]));
    expect(result.resumePlan.skillDistribution.find(item => item.skill === 'Helm')).toMatchObject({ status: 'Unverified suggestion', occurrences: 0 });
  });

  it('calculates evidence-based coverage and never counts inferred skills as covered', () => {
    const result = analyzeJD({ title: 'Senior PostgreSQL DBA', jdText: postgresJD }, candidate);
    expect(result.coverage.mandatory.covered).toContain('PostgreSQL');
    expect(result.coverage.preferred.gaps).toEqual(expect.arrayContaining(['Patroni', 'pgBackRest', 'AWS']));
    expect(result.resumePlan.coverageTargets).toEqual({ mandatory: 95, required: 80, preferred: 65 });
  });

  it('produces a grounded placement plan rather than resume text', () => {
    const result = analyzeJD({ title: 'Senior PostgreSQL DBA', jdText: postgresJD }, candidate);
    expect(result.resumePlan.skillDistribution.find(item => item.skill === 'PostgreSQL')).toMatchObject({ status: 'Verified', sections: expect.arrayContaining(['Technical Skills', 'Current Experience']) });
    expect(result.resumePlan.responsibilityDistribution.length).toBeGreaterThan(0);
    expect(result.resumePlan.guardrails.join(' ')).toMatch(/Do not invent numeric impact/);
    expect(JSON.stringify(result.resumePlan)).not.toMatch(/generatedResume|resumeContent/);
  });

  it('maps ATS synonyms without rewriting factual candidate records', () => {
    const result = analyzeJD({ title: 'SRE', jdText: 'K8s and telemetry are required. Amazon Web Services is preferred.' });
    expect(result.normalizedTitle).toBe('Site Reliability Engineer');
    expect(result.explicitSkills).toEqual(expect.arrayContaining(['Kubernetes', 'Observability']));
    expect(result.atsSynonyms.Kubernetes).toContain('K8s');
    expect(candidate.career.experience[0].title).toBe('Database Administrator');
  });
});
