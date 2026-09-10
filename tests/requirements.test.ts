import { describe, expect, it } from 'vitest';
import { candidateRequiredFields, careerRequiredFields, jobRequiredFields, resumeGenerationRequiredFields } from '../lib/requirements';

describe('required data contract', () => {
  it('flags missing candidate identity and matching data', () => {
    expect(candidateRequiredFields({ firstName: 'John', email: 'bad' })).toEqual(expect.arrayContaining(['Last name', 'Phone', 'Current location', 'Job family', 'Valid email address']));
  });

  it('uses the same candidate readiness gate for resume generation', () => {
    expect(resumeGenerationRequiredFields({
      firstName: 'John',
      lastName: 'Carter',
      email: 'john@example.com',
      phone: '+1 555 0100',
      location: 'Cincinnati',
      family: 'DevOps',
      career: { experience: [], education: [], certifications: [], projects: [] },
    })).toEqual(['At least one employment record']);
  });
  it('requires one verifiable employment record before generation', () => {
    expect(careerRequiredFields({ experience: [], education: [], certifications: [], projects: [] })).toEqual(['At least one employment record']);
  });
  it('requires complete job routing data', () => {
    expect(jobRequiredFields({ company: 'Acme', title: 'Platform Engineer', jdText: 'AWS' })).toEqual(expect.arrayContaining(['Job location', 'Work type', 'Job family']));
  });
});
