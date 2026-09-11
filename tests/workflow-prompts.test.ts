import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { structuredAI, type AIEvent } from '../lib/ai-client';
import { aiJDHash, analyzeJDWithLLM } from '../lib/ai-jd';
import { createJDProfile } from '../lib/jd-profile';
import { defaultWorkflowPrompt, OUTPUT_CONTRACT } from '../lib/workflow-prompts';
import { usageSummary, type LLMUsageRecord } from '../lib/llm-usage';
import { resumeDocxDocument } from '../lib/resume-docx';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { writeFile } from 'node:fs/promises';
import type { ResumeContent } from '../lib/types';

afterEach(() => vi.unstubAllGlobals());
const config = { key: 'test-only', model: 'test-model' };
const jsonResponse = (extra: object = {}) => new Response(JSON.stringify({ id: 'resp-1', status: 'completed', output: [{ content: [{ type: 'output_text', text: '"ok"' }] }], usage: { input_tokens: 100, output_tokens: 50, input_tokens_details: { cached_tokens: 20 }, output_tokens_details: { reasoning_tokens: 10 } }, ...extra }));
describe('Published workflow prompts', () => {
  it('uses the published JD text and snapshots it; edits, versions and models invalidate cache', async () => {
    const input = { company: 'Acme', title: 'DevOps Engineer', family: 'DevOps', jdText: 'AWS required.' };
    const prompt = { ...defaultWorkflowPrompt('jd-normalization'), template: 'Administrator normalization instructions', version: 7 };
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(createJDProfile(input, 'x').jdProfile) }] }] }));
    vi.stubGlobal('fetch', fetch);
    const result = await analyzeJDWithLLM(config, input, prompt);
    expect(JSON.parse(fetch.mock.calls[0][1].body).instructions).toBe(prompt.template + '\n\n' + OUTPUT_CONTRACT);
    expect(result.promptSnapshot).toEqual(prompt);
    const hash = (await aiJDHash(input, config.model, prompt)).hash;
    for (const changed of [{ ...prompt, version: 8 }, { ...prompt, template: prompt.template + ' Changed.' }]) expect((await aiJDHash(input, config.model, changed)).hash).not.toBe(hash);
    expect((await aiJDHash(input, 'another-model', prompt)).hash).not.toBe(hash);
  });
});
describe('LLM telemetry', () => {
  it('records one dispatch and final event with provider token breakdowns', async () => {
    const events: AIEvent[] = [];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse()));
    await structuredAI({ ...config, observe: async e => { events.push(e); } }, 'test', z.string(), '', {}, 100);
    expect(events.map(e => e.status)).toEqual(['dispatching', 'completed']);
    expect(events[1]).toMatchObject({ httpStatus: 200, usage: { inputTokens: 100, outputTokens: 50, cachedInputTokens: 20, reasoningTokens: 10 } });
  });
  it.each(['incomplete', 'refused', 'invalid-structured-output'])('retains consumed tokens on %s', async outcome => {
    const events: AIEvent[] = [];
    const body = outcome === 'incomplete' ? { status: 'incomplete' } : outcome === 'refused' ? { output: [{ content: [{ type: 'refusal' }] }] } : { output: [] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)));
    await expect(structuredAI({ ...config, observe: async e => { events.push(e); } }, 'test', z.string(), '', {}, 100)).rejects.toThrow();
    expect(events[1]).toMatchObject({ status: 'failed', outcome, usage: { inputTokens: 100, outputTokens: 50 } });
  });
  it('does not invent zero usage on HTTP/network failures or missing provider usage', async () => {
    for (const result of [new Response('', { status: 429 }), jsonResponse({ usage: null })]) {
      const events: AIEvent[] = [];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(result));
      await structuredAI({ ...config, observe: async e => { events.push(e); } }, 'test', z.string(), '', {}, 100).catch(() => {});
      expect(events[1].usage).toBeUndefined();
    }
  });
  it('does not spend when preflight or initial tracking fails, and keeps results if final tracking fails', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse()); vi.stubGlobal('fetch', fetch);
    const observe = vi.fn().mockRejectedValue(new Error('Tracking unavailable'));
    await expect(structuredAI({ ...config, key: '', observe }, 'test', z.string(), '', {}, 100)).rejects.toThrow();
    expect(observe).not.toHaveBeenCalled();
    await expect(structuredAI({ ...config, observe }, 'test', z.string(), '', {}, 100)).rejects.toThrow('Tracking unavailable');
    expect(fetch).not.toHaveBeenCalled();
    const finalFails = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Offline'));
    expect((await structuredAI({ ...config, observe: finalFails }, 'test', z.string(), '', {}, 100)).value).toBe('ok');
  });
  it('deduplicates responses, counts cached reuses separately and never double-counts subsets', () => {
    const base: LLMUsageRecord = { id: '1', model: 'm', stage: 'resume-generation', status: 'completed', startedAt: '', usage: { responseId: 'r', inputTokens: 100, outputTokens: 50, cachedInputTokens: 20, reasoningTokens: 10 }, durationMs: 1000 };
    expect(usageSummary([base, { ...base, id: 'historical' }, { ...base, id: 'cache', status: 'cache-hit', usage: undefined, durationMs: undefined }, { ...base, id: 'failure', status: 'failed', usage: undefined }, { ...base, id: 'pending', status: 'dispatching', usage: undefined, durationMs: undefined }])).toMatchObject({ calls: 3, total: 150, input: 100, output: 50, cachedInput: 20, reasoning: 10, cacheHits: 1, failed: 1, pending: 1, unknown: 2, averageMs: 1000 });
    expect(usageSummary([{ ...base, usage: { ...base.usage!, reported: false } }])).toMatchObject({ total: 0, unknown: 1 });
    expect(usageSummary([])).toMatchObject({ total: 0, calls: 0, averageMs: null });
  });
});
describe('Word resume formatting', () => {
  it('applies Aptos 9 pt to every run and justifies every paragraph, preserving all resume sections', async () => {
    const content: ResumeContent = { name: 'Asha Reddy', headline: 'Engineer', contact: 'asha@example.com', summary: 'Built AWS systems.\nMaintained services.', skills: ['AWS'], skillCategories: [{ category: 'Cloud', skills: ['AWS'] }], experience: [{ title: 'Engineer', company: 'Example Employer', location: 'Hyderabad', dates: '2020 – Present', bullets: ['Built AWS systems with documented workflows.'] }], education: ['BS, University'], certifications: ['Held certification'], projects: ['Project · https://github.com/example/project'], highlights: ['AWS'] };
    const buffer = await Packer.toBuffer(resumeDocxDocument(content));
    if (process.env.DOCX_QA_OUTPUT) await writeFile(process.env.DOCX_QA_OUTPUT, buffer);
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g)!;
    expect(paragraphs.length).toBeGreaterThan(10);
    for (const p of paragraphs) expect(p).toContain('<w:jc w:val="both"/>');
    for (const r of xml.match(/<w:r[ >][\s\S]*?<\/w:r>/g)!) { expect(r).toContain('w:ascii="Aptos"'); expect(r).toContain('<w:sz w:val="18"/>'); }
    for (const text of ['Asha Reddy', 'Example Employer', 'Hyderabad', 'BS, University', 'Held certification', 'https://github.com/example/project']) expect(xml).toContain(text);
    expect(xml).not.toContain('<w:tbl>');
    expect(await zip.file('word/numbering.xml')!.async('string')).toContain('w:ascii="Aptos"');
  });
});
