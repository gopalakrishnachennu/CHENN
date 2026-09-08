import { describe, expect, it } from 'vitest';
import { candidateRequiredFields, careerRequiredFields, jobRequiredFields } from '../lib/requirements';

describe('required data contract', () => {
  it('flags missing candidate identity and matching data', () => {
    expect(candidateRequiredFields({ firstName: 'John', email: 'bad' })).toEqual(expect.arrayContaining(['Last name', 'Phone', 'Target location', 'Job family', 'Valid email address']));
  });
  it('requires one verifiable employment record before generation', () => {
    expect(careerRequiredFields({ experience: [], education: [], certifications: [], projects: [] })).toEqual(['At least one employment record']);
  });
  it('requires complete job routing data', () => {
    expect(jobRequiredFields({ company: 'Acme', title: 'Platform Engineer', jdText: 'AWS' })).toEqual(expect.arrayContaining(['Job location', 'Work type', 'Job family']));
  });
});
