import { describe, expect, it } from 'vitest';
import { analyzeJD } from '../lib/jd-intelligence';
import { candidateGenerationInput, createJDProfile, jdFingerprint } from '../lib/jd-profile';
import type { Candidate } from '../lib/types';

const input = { title: 'DevOps Engineer', company: 'Acme', family: 'DevOps', jdText: 'AWS is mandatory.\nKubernetes required.\nPython preferred.\nBuild reliable deployment pipelines.' };
describe('shared versioned JD profile', () => {
  it('normalizes harmless whitespace and invalidates relevant source changes', async () => {
    const hash = await jdFingerprint(input);
    expect(await jdFingerprint({ ...input, jdText: '  ' + input.jdText.replaceAll('\n', '\r\n  ') })).toBe(hash);
    for (const changes of [{ jdText: input.jdText + '\nAzure required.' }, { title: 'SRE' }, { family: 'Cloud' }])
      expect(await jdFingerprint({ ...input, ...changes })).not.toBe(hash);
  });
  it('stores P1–P4 separately without inventing credentials', () => {
    const cached = createJDProfile(input, 'hash');
    expect(cached.jdProfile.mandatory_skills).toContain('AWS');
    expect(cached.jdProfile.preferred_skills).toContain('Python');
    expect(cached.jdProfile.mandatory_certifications).toEqual([]);
    expect(cached.engine).toBe('rules');
  });
  it('matches candidates from the cached requirements without original JD text', () => {
    const cached = createJDProfile(input, 'hash');
    const before = JSON.stringify(cached);
    const candidate = { skills: [{ name: 'AWS', source: 'Profile', evidence: 'Built AWS services' }] } as Candidate;
    const direct = analyzeJD(input, candidate);
    const reused = analyzeJD({ ...input, jdText: '' }, candidate, undefined, cached.intelligence);
    expect(reused.coverage).toEqual(direct.coverage);
    expect(reused.requirements).toEqual(direct.requirements);
    expect(reused.subFamily).toBe(direct.subFamily);
    analyzeJD({ ...input, jdText: '' }, { skills: [] } as unknown as Candidate, undefined, cached.intelligence);
    expect(JSON.stringify(cached)).toBe(before);
  });
  it('sends only cached profile and candidate evidence into the generation input', () => {
    const cached = createJDProfile(input, 'hash');
    const result = JSON.parse(candidateGenerationInput(cached.jdProfile, input.title, [{ id: 'experience:0:0', text: 'Built AWS services' }]));
    expect(result.JD_PROFILE).toEqual(cached.jdProfile);
    expect(result.jdText).toBeUndefined();
    expect(result.verified_candidate_evidence).toHaveLength(1);
  });
});
