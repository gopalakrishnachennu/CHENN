import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { structuredAI } from '../lib/ai-client';
import { aiJDHash, analyzeJDWithLLM } from '../lib/ai-jd';
import { createJDProfile } from '../lib/jd-profile';
import { allowedResumeSkills, familyApprovedResumeSkills, generationResumeSkills, validateAIResumeEdit, validateResumeDraft, writeResumeWithLLM, type ResumeDraft } from '../lib/ai-resume';
import { confirmQualifications } from '../lib/qualification-confirmation';
import { highlightRuns } from '../lib/resume-format';
import { careerSchema } from '../lib/career';
import { defaultWorkflowPrompt, OUTPUT_CONTRACT } from '../lib/workflow-prompts';
import type { Candidate, Job } from '../lib/types';

const config = { key: 'test-key-not-a-secret', model: 'configured-model' };
const posting = { title: 'Platform Engineer', company: 'Acme', family: 'DevOps', jdText: 'UNIQUE RAW JD SENTINEL\nAWS is mandatory.\nKubernetes preferred.' };
const profile = createJDProfile(posting, 'hash');
const candidate = { id: 'c', name: 'Alex Smith', email: 'alex@example.com', phone: '555-0100', location: 'Boston', family: 'DevOps', skills: [], career: careerSchema.parse({
  experience: [{ company: 'Real Employer', title: 'Engineer', start: '2020-01', end: '', current: true, location: 'Boston', technologies: 'AWS', responsibilities: 'Built AWS infrastructure supporting internal services through reusable modules and documented workflows, helping team members deploy workloads consistently across approved environments.', achievements: '' }],
  education: [{ institution: 'University', degree: 'BS', field: 'Computing', start: '2016-01', end: '2020-01' }],
  certifications: [{ name: 'AWS Solutions Architect', issuer: 'Amazon', start: '', end: '', url: '' }], projects: [],
}) } as unknown as Candidate;
const job = { ...posting, jdProfile: profile.jdProfile, targetRole: 'Platform Engineer', mandatorySkills: ['AWS'], preferredSkills: [] } as unknown as Job;
const draft = (): ResumeDraft => ({ summary: [{ text: 'Engineer experienced in AWS infrastructure.', sourceRefs: ['experience:0:0'], keywords: ['AWS'] }], skillCategories: [{ category: 'Cloud', skills: ['AWS'] }], experience: [{ experienceIndex: 0, bullets: [{ text: candidate.career!.experience[0].responsibilities, sourceRefs: ['experience:0:0'], keywords: ['AWS'] }] }], gaps: ['Kubernetes not confirmed.'] });
const response = (value: unknown) => new Response(JSON.stringify({ id: 'resp_test', status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }], usage: { input_tokens: 100, output_tokens: 50 } }));
afterEach(() => vi.unstubAllGlobals());

describe('OpenAI request contract', () => {
  it('uses structured output, store:false, configured model and bounded tokens', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ result: 'ok' })); vi.stubGlobal('fetch', fetch);
    const result = await structuredAI(config, 'test', z.object({ result: z.string() }).strict(), 'Policy', { source: 'data' }, 1000);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({ model: 'configured-model', store: false, max_output_tokens: 1000, text: { format: { type: 'json_schema', strict: true } } });
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50, responseId: 'resp_test' });
  });
  it.each([401, 429, 500])('fails clearly without silently falling back or retrying HTTP %s', async status => {
    const fetch = vi.fn().mockResolvedValue(new Response('provider failure', { status })); vi.stubGlobal('fetch', fetch);
    await expect(structuredAI(config, 'test', z.string(), '', {}, 1000)).rejects.toThrow(`(${status})`);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects incomplete, refused and invalid responses', async () => {
    for (const body of [{ status: 'incomplete' }, { status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }, { status: 'completed', output: [] }]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
      await expect(structuredAI(config, 'test', z.string(), '', {}, 1000)).rejects.toThrow();
    }
  });
  it('makes no request without a key or when input exceeds the explicit limit', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(structuredAI({ ...config, key: '' }, 'test', z.string(), '', {}, 1000)).rejects.toThrow('Admin Settings');
    await expect(structuredAI(config, 'test', z.string(), '', 'x'.repeat(160001), 1000)).rejects.toThrow('too large');
    expect(fetch).not.toHaveBeenCalled();
  });
});
describe('LLM JD analysis and resume writing', () => {
  it('creates an LLM profile and changes cache identity with model/source', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(profile.jdProfile)));
    expect(await analyzeJDWithLLM(config, posting)).toMatchObject({ engine: 'openai', analysisVersion: 'llm-jd-v2', model: config.model });
    expect((await aiJDHash(posting, 'model-b')).hash).not.toBe((await aiJDHash(posting, config.model)).hash);
    expect((await aiJDHash({ ...posting, jdText: 'Changed JD' }, config.model)).hash).not.toBe((await aiJDHash(posting, config.model)).hash);
  });
  it('writes from cached JD only and preserves factual records', async () => {
    const fetch = vi.fn().mockResolvedValue(response(draft())); vi.stubGlobal('fetch', fetch);
    const prompt = { ...defaultWorkflowPrompt('resume-generation'), version: 3, template: 'My published resume instructions' };
    const generated = await writeResumeWithLLM(config, candidate, job, '', prompt);
    expect(JSON.parse(fetch.mock.calls[0][1].body).instructions).toBe(prompt.template + '\n\n' + OUTPUT_CONTRACT);
    const input = JSON.parse(fetch.mock.calls[0][1].body).input;
    expect(input).not.toContain('UNIQUE RAW JD SENTINEL');
    expect(generated.content).toMatchObject({ name: candidate.name, skillCategories: [{ category: 'Cloud', skills: ['AWS'] }], experience: [{ company: 'Real Employer', title: 'Engineer', dates: '2020-01 – Present' }] });
    expect(generated.content.certifications?.join(' ')).toContain('AWS Solutions Architect');
    expect(generated.content.education.join(' ')).toContain('University');
    expect(generated.validation.passed).toBe(true);
    expect(generated.fallback).toBe(false);
    expect(generated.validation.warnings.length).toBeGreaterThan(0);
  });
  it('creates a grounded resume without a second AI call when AI wording fails validation', async () => {
    const invalid = draft(); invalid.skillCategories[0].skills.push('Terraform');
    const fetch = vi.fn().mockResolvedValue(response(invalid)); vi.stubGlobal('fetch', fetch);
    const generated = await writeResumeWithLLM(config, candidate, job, 'Concise');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(generated.fallback).toBe(true);
    expect(generated.validation).toMatchObject({ passed: true, errors: [] });
    expect(generated.validation.warnings.join(' ')).toContain('automatically created this grounded draft');
    expect(generated.content.skills).toEqual(expect.arrayContaining(['AWS', 'Kubernetes']));
    expect(generated.content.experience[0]).toMatchObject({ company: 'Real Employer', title: 'Engineer' });
    expect(generated.content.experience[0].bullets).toContain(candidate.career!.experience[0].responsibilities);
    expect(generated.evidenceMap.some(item => item.sourceRef === 'family:approved-jd-skills')).toBe(true);
  });
  it('blocks unverified keywords, wrong employer evidence, metrics and duplicate roles', () => {
    const invented = draft(); invented.skillCategories[0].skills.push('Terraform');
    expect(validateResumeDraft(invented, candidate, job).passed).toBe(false);
    const metric = draft(); metric.experience[0].bullets[0].text += ' Improved performance by 70%.';
    expect(validateResumeDraft(metric, candidate, job).errors.join(' ')).toContain('metric 70%');
    const wrong = draft(); wrong.experience[0].bullets[0].sourceRefs = ['education:0'];
    expect(validateResumeDraft(wrong, candidate, job).errors.join(' ')).toContain('another employer');
    const concealed = draft(); concealed.summary[0].text = 'Certified in CKA'; concealed.summary[0].keywords = [];
    const certificationJob = { ...job, jdProfile: { ...job.jdProfile!, mandatory_certifications: ['CKA'] } };
    expect(validateResumeDraft(concealed, candidate, certificationJob).passed).toBe(false);
    const duplicate = draft(); duplicate.experience.push(duplicate.experience[0]);
    expect(validateResumeDraft(duplicate, candidate, job).passed).toBe(false);
  });
  it('allows same-family JD skills in summary and skills, but not unsupported employer claims', () => {
    expect(familyApprovedResumeSkills(candidate, job)).toContain('Kubernetes');
    expect(generationResumeSkills(candidate, job)).toEqual(expect.arrayContaining(['AWS', 'Kubernetes']));
    const aligned = draft();
    aligned.summary[0] = { text: 'DevOps engineer aligned with Kubernetes environments.', sourceRefs: ['experience:0:0'], keywords: ['Kubernetes'] };
    aligned.skillCategories[0].skills.push('Kubernetes');
    expect(validateResumeDraft(aligned, candidate, job).passed).toBe(true);
    aligned.experience[0].bullets[0].text = 'Built Kubernetes platforms for production teams using reusable modules and documented workflows, helping engineers deploy workloads consistently across approved environments with reliable operational practices.';
    aligned.experience[0].bullets[0].keywords = ['Kubernetes'];
    expect(validateResumeDraft(aligned, candidate, job).errors.join(' ')).toContain('employer evidence does not support Kubernetes');
  });
  it('does not permit changed education or unverified skill edits', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(draft())));
    const generated = await writeResumeWithLLM(config, candidate, job, '');
    expect(() => validateAIResumeEdit({ ...generated.content, education: ['Invented degree'] }, generated.content, generated.evidenceMap)).toThrow('verified candidate');
    expect(() => validateAIResumeEdit({ ...generated.content, skills: ['Unconfirmed skill'] }, generated.content, generated.evidenceMap)).toThrow('Confirm new skills');
  });
});
describe('Candidate qualification confirmations and formatting', () => {
  it('accepts optional notes and requires issuer; general skills never become employer history', () => {
    const entered = confirmQualifications(candidate, [{ kind: 'skill', name: 'Python', evidence: '' }], 'admin', 'now');
    expect(allowedResumeSkills({ ...candidate, ...entered })).toContain('Python');
    expect(entered.career.experience).toEqual(candidate.career!.experience);
    expect(() => confirmQualifications(candidate, [{ kind: 'certification', name: 'CKA', evidence: 'Candidate confirmed credential' }], 'admin', 'now')).toThrow();
    const updated = confirmQualifications(candidate, [{ kind: 'skill', name: 'Python', evidence: 'Candidate demonstrated a Python project' }, { kind: 'certification', name: 'CKA', issuer: 'CNCF', evidence: 'Credential reviewed with candidate' }], 'admin', 'now');
    expect(updated.career.experience).toEqual(candidate.career!.experience);
    expect(updated.career.certifications.some(c => c.name === 'CKA')).toBe(true);
    expect(allowedResumeSkills({ ...candidate, ...updated })).toContain('Python');
    expect(updated.qualificationConfirmations[0].confirmedBy).toBe('admin');
  });
  it('associates confirmed employment evidence only with the selected employer', () => {
    const updated = confirmQualifications(candidate, [{ kind: 'skill', name: 'Python', evidence: 'Built Python tools at this employer', experienceIndex: 0 }], 'admin', 'now');
    expect(updated.career.experience[0].responsibilities).toContain('Built Python tools');
    expect(() => confirmQualifications(candidate, [{ kind: 'skill', name: 'Python', evidence: 'Candidate confirmed', experienceIndex: 8 }], 'admin', 'now')).toThrow('existing employment');
  });
  it('bolds literal keywords, preserving text without interpreting markup', () => {
    const runs = highlightRuns('Built C++ APIs on AWS, not AWSome.', ['C++', 'AWS']);
    expect(runs.filter(r => r.bold).map(r => r.text)).toEqual(['C++', 'AWS']);
    expect(runs.map(r => r.text).join('')).toBe('Built C++ APIs on AWS, not AWSome.');
  });
});
