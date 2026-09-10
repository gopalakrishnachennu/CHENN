import { describe, it, expect } from 'vitest';
import { adaptJobFeed, catalogId, evaluateMatch, normalizeJob, parseJobImport, preferences, type CatalogJob } from '../lib/matching';
import type { Candidate } from '../lib/types';

const job: CatalogJob = { ...normalizeJob({ salary: 'USD 120,000–160,000/year', sourceUrl: 'https://example.com/jobs/1', company: 'Acme', title: 'Platform Engineer', family: 'DevOps', role: 'Platform Engineer', location: 'Seattle', workType: 'Hybrid', authorization: 'US authorized', seniority: 'Senior', minimumYears: 5, salaryMax: 160000, jdText: 'AWS platform operations', mandatorySkills: ['AWS'], criticalSkills: ['AWS'], preferredSkills: ['Python'], expiresAt: '2027-01-01' }, '2026-09-01T00:00:00Z'), id: 'job' };
const candidate = { id: 'candidate', firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '555-0100', location: 'Seattle', family: 'DevOps', status: 'Active', skills: ['AWS', 'Python'].map(name => ({ name, evidence: 'Verified project', source: 'Profile' })), matchPreferences: preferences({ targetRoles: ['Platform Engineer'], locations: ['Seattle'], workTypes: ['Hybrid'], authorizations: ['US authorized'], seniorities: ['Senior'], yearsExperience: 7, minimumSalary: 120000 }) } as Candidate;
const evaluate = (j = job, c = candidate) => evaluateMatch(j, c, new Date('2026-09-08'));
describe('Family taxonomy matching only', () => {
  it('matches the primary family regardless of missing profile details', () => {
    expect(evaluate(job, { ...candidate, skills: [], career: undefined, matchPreferences: undefined, firstName: '', phone: '', status: 'Paused' })).toMatchObject({ eligibility: 'Eligible', decision: 'Selected', missingMandatory: [], policyVersion: 'family-only-v1' });
  });
  it('ignores qualifications, role, experience, location, salary and authorization', () => {
    expect(evaluate({ ...job, role: 'Different', minimumYears: 50, location: 'Elsewhere', workType: 'Other', authorization: 'Other', salaryMax: 1, mandatorySkills: ['Unknown'], criticalSkills: ['Unknown'], familyConfidence: 0 })).toMatchObject({ eligibility: 'Eligible', decision: 'Selected' });
  });
  it('matches approved secondary families', () => {
    expect(evaluate(job, { ...candidate, family: 'Other', matchPreferences: { ...candidate.matchPreferences!, secondaryFamilies: ['DevOps'] } }).decision).toBe('Selected');
  });
  it('does not match a different family despite identical qualifications', () => {
    expect(evaluate({ ...job, family: 'Data Engineering' }).eligibility).toBe('Ineligible');
  });
  it('normalizes taxonomy casing and whitespace', () => {
    expect(evaluate({ ...job, family: '  DEVOPS  ' }).decision).toBe('Selected');
  });
  it('keeps unassigned and pending jobs out of matching', () => {
    expect(evaluate({ ...job, family: 'Custom / needs review' }).decision).toBe('Rejected');
    expect(evaluate({ ...job, analysisStatus: 'Pending' }).decision).toBe('Rejected');
  });
  it('keeps closed and expired vacancies unavailable for applications', () => {
    expect(evaluate({ ...job, status: 'Closed' }).eligibility).toBe('Ineligible');
    expect(evaluate({ ...job, expiresAt: '2020-01-01' }).eligibility).toBe('Ineligible');
  });
});
describe('Job import', () => {
  it('requires a real URL and explicit salary wording without annualizing hourly rates', () => {
    for (const field of ['sourceUrl', 'salary']) expect(() => normalizeJob({ ...job, [field]: '  ' })).toThrow(`${field} is required`);
    const hourly = normalizeJob({ ...job, salary: 'USD 70–90/hour', salaryMax: null });
    expect(hourly.salary).toBe('USD 70–90/hour');
    expect(hourly.salaryMax).toBeNull();
  });
  it('parses quoted multiline JDs and commas', () => { expect(parseJobImport('company,title,jdText\r\nAcme,"Engineer, platform","AWS\nPython ""required"""')).toEqual([{ company: 'Acme', title: 'Engineer, platform', jdText: 'AWS\nPython "required"' }]); });
  it('accepts JSON arrays, rejecting primitives and malformed CSV', () => { expect(parseJobImport('[{"company":"Acme"}]')).toHaveLength(1); expect(() => parseJobImport('[1]')).toThrow(); expect(() => parseJobImport('a,a\n1,2')).toThrow(); expect(() => parseJobImport('a,b\n"unclosed')).toThrow(); });
  it('strips tracking while retaining job identifiers', () => { expect(normalizeJob({ ...job, sourceUrl: 'https://example.com/job?id=123&utm_source=test#top' }).sourceUrl).toBe('https://example.com/job?id=123'); expect(() => normalizeJob({ ...job, sourceUrl: 'javascript:alert(1)' })).toThrow(); });
});
