import { describe, expect, it } from 'vitest';
import { buildSkillPlan, calculateMatch, canTransitionStatus, extractSkillRequirements } from '../lib/server/policy';
import { decryptSecret, encryptSecret } from '../lib/server/crypto';
import type { CandidateSkill, JobFamily } from '../lib/types';

const family: JobFamily = {
  id: 'devops',
  name: 'DevOps',
  description: '',
  roles: ['DevOps Engineer'],
  skills: ['AWS', 'Terraform', 'Kubernetes', 'Prometheus'],
  active: true,
  createdAt: '2026-09-07T00:00:00.000Z',
  updatedAt: '2026-09-07T00:00:00.000Z',
};

const profile: CandidateSkill[] = [
  { id: '1', name: 'AWS', proficiency: 'Advanced', years: 6, evidence: 'Operated production AWS infrastructure.', source: 'Profile' },
  { id: '2', name: 'Kubernetes', proficiency: 'Advanced', years: 4, evidence: 'Owned Kubernetes reliability.', source: 'Profile' },
];

describe('JD-first policy', () => {
  it('separates mandatory and preferred requirements from the JD', () => {
    const result = extractSkillRequirements(
      'Strong AWS, Terraform and Kubernetes experience required. Prometheus is preferred.',
      family,
    );
    expect(result.mandatory).toEqual(expect.arrayContaining(['AWS', 'Terraform', 'Kubernetes']));
    expect(result.preferred).toContain('Prometheus');
  });

  it('uses profile evidence first, family enrichment second, and blocks unrelated mandatory skills', () => {
    const plan = buildSkillPlan(profile, family, ['AWS', 'Terraform', 'TensorFlow'], ['Prometheus']);
    expect(plan.find((item) => item.name === 'AWS')?.source).toBe('Profile');
    expect(plan.find((item) => item.name === 'Terraform')?.source).toBe('JD + Family');
    expect(plan.find((item) => item.name === 'TensorFlow')?.source).toBe('Missing');
    expect(plan.find((item) => item.name === 'Prometheus')?.source).toBe('JD + Family');
    expect(calculateMatch(plan)).toBeLessThan(100);
  });

  it('accepts only modeled application transitions', () => {
    expect(canTransitionStatus('Applied', 'Interview')).toBe(true);
    expect(canTransitionStatus('Selected', 'Offer')).toBe(false);
    expect(canTransitionStatus('Interview', 'Interview')).toBe(true);
  });
});

describe('credential encryption', () => {
  it('round-trips a secret and fails with a different encryption key', async () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    const wrongKey = Buffer.alloc(32, 8).toString('base64');
    const encrypted = await encryptSecret('sk-test-value-never-logged', key);
    expect(encrypted.cipherText).not.toContain('sk-test');
    await expect(decryptSecret(encrypted.cipherText, encrypted.iv, key)).resolves.toBe('sk-test-value-never-logged');
    await expect(decryptSecret(encrypted.cipherText, encrypted.iv, wrongKey)).rejects.toThrow();
  });
});
