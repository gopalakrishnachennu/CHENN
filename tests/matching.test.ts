import { describe, it, expect } from 'vitest';
import { adaptJobFeed, catalogId, evaluateMatch, normalizeJob, parseJobImport, preferences, type CatalogJob } from '../lib/matching';
import type { Candidate } from '../lib/types';

const job: CatalogJob = { ...normalizeJob({ company: 'Acme', title: 'Platform Engineer', family: 'DevOps', role: 'Platform Engineer', location: 'Seattle', workType: 'Hybrid', authorization: 'US authorized', seniority: 'Senior', minimumYears: 5, salaryMax: 160000, jdText: 'AWS platform operations', mandatorySkills: ['AWS'], criticalSkills: ['AWS'], preferredSkills: ['Python'], expiresAt: '2027-01-01' }, '2026-09-01T00:00:00Z'), id: 'job' };
const candidate = { id: 'candidate', firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '555-0100', location: 'Seattle', family: 'DevOps', status: 'Active', skills: ['AWS', 'Python'].map(name => ({ name, evidence: 'Verified project', source: 'Profile' })), matchPreferences: preferences({ targetRoles: ['Platform Engineer'], locations: ['Seattle'], workTypes: ['Hybrid'], authorizations: ['US authorized'], seniorities: ['Senior'], yearsExperience: 7, minimumSalary: 120000 }) } as Candidate;
const evaluate = (j = job, c = candidate) => evaluateMatch(j, c, new Date('2026-09-08'));
describe('Family + eligibility + score', () => {
  it('selects an evidenced eligible candidate', () => { expect(evaluate()).toMatchObject({ score: 100, eligibility: 'Eligible', decision: 'Selected' }); });
  it('blocks a critical requirement regardless of adjacent skills', () => { expect(evaluate(job, { ...candidate, skills: candidate.skills.filter(s => s.name !== 'AWS') })).toMatchObject({ decision: 'Rejected', eligibility: 'Ineligible', missingMandatory: ['AWS'] }); });
  it('requires evidence; family enrichment cannot masquerade as verified experience', () => { expect(evaluate(job, { ...candidate, skills: candidate.skills.map(s => ({ ...s, evidence: '' })) }).decision).toBe('Rejected'); });
  it('accepts an explicitly approved secondary family', () => { expect(evaluate(job, { ...candidate, family: 'Cloud', matchPreferences: { ...candidate.matchPreferences!, secondaryFamilies: ['DevOps'] } }).decision).toBe('Selected'); });
  it.each(['location', 'workType', 'authorization', 'seniority'] as const)('blocks incompatible %s', key => { expect(evaluate({ ...job, [key]: 'Incompatible' }).eligibility).toBe('Ineligible'); });
  it('reviews missing eligibility data rather than treating it as a pass', () => { expect(evaluate(job, { ...candidate, matchPreferences: undefined }).decision).not.toBe('Selected'); });
  it('reviews low-confidence classification and unmatched target roles', () => { expect(evaluate({ ...job, familyConfidence: 60 }).decision).toBe('Review'); expect(evaluate({ ...job, role: 'Cloud Engineer' }).decision).toBe('Review'); });
  it('blocks expired and closed jobs', () => { expect(evaluate({ ...job, expiresAt: '2026-01-01' }).decision).toBe('Rejected'); expect(evaluate({ ...job, status: 'Closed' }).decision).toBe('Rejected'); });
  it('does not compare salaries across currencies', () => { expect(evaluate({ ...job, currency: 'EUR' }).decision).toBe('Review'); });
  it('rejects invalid thresholds and numeric input', () => { expect(() => preferences({ minimumScore: 101 })).toThrow(); expect(() => normalizeJob({ ...job, minimumYears: 'abc' })).toThrow(); });
  it('uses aliases without inventing skills', () => { expect(evaluate({ ...job, mandatorySkills: ['Amazon Web Services'], criticalSkills: ['Amazon Web Services'] }).decision).toBe('Selected'); });
  it('adapts Greenhouse and Lever feed envelopes without guessing family', () => {
    const rows = parseJobImport(JSON.stringify({ jobs: [{ absolute_url: 'https://boards.greenhouse.io/acme/jobs/1', companyName: 'Acme', title: 'SRE', location: { name: 'Remote' }, content: 'AWS required', family: 'DevOps', workType: 'Remote' }] }));
    expect(rows[0]).toMatchObject({ source: 'Greenhouse', company: 'Acme', title: 'SRE', location: 'Remote', jdText: 'AWS required', family: 'DevOps' });
    expect(adaptJobFeed([{ hostedUrl: 'https://jobs.lever.co/acme/1', organization: 'Acme', name: 'Platform', text: 'Kubernetes', family: 'DevOps', locationName: 'Remote' }])[0]).toMatchObject({ source: 'Lever', title: 'Platform', jdText: 'Kubernetes' });
  });
  it('deduplicates syndicated and case/whitespace variations', async () => { expect(await catalogId(job)).toBe(await catalogId({ ...job, company: '  ACME ' })); expect(await catalogId(job)).not.toBe(await catalogId({ ...job, location: 'Austin' })); });
});
describe('Job import', () => {
  it('parses quoted multiline JDs and commas', () => { expect(parseJobImport('company,title,jdText\r\nAcme,"Engineer, platform","AWS\nPython ""required"""')).toEqual([{ company: 'Acme', title: 'Engineer, platform', jdText: 'AWS\nPython "required"' }]); });
  it('accepts JSON arrays, rejecting primitives and malformed CSV', () => { expect(parseJobImport('[{"company":"Acme"}]')).toHaveLength(1); expect(() => parseJobImport('[1]')).toThrow(); expect(() => parseJobImport('a,a\n1,2')).toThrow(); expect(() => parseJobImport('a,b\n"unclosed')).toThrow(); });
  it('strips tracking while retaining job identifiers', () => { expect(normalizeJob({ ...job, sourceUrl: 'https://example.com/job?id=123&utm_source=test#top' }).sourceUrl).toBe('https://example.com/job?id=123'); expect(() => normalizeJob({ ...job, sourceUrl: 'javascript:alert(1)' })).toThrow(); });
});
