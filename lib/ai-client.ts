import { z } from 'zod';

export type AIEvent = { status: 'dispatching' | 'completed' | 'failed'; outcome?: string; httpStatus?: number; usage?: AIUsage; durationMs?: number };
export type AIConfig = { key: string; model: string; observe?: (event: AIEvent) => Promise<void> };
export type AIUsage = { inputTokens: number; outputTokens: number; responseId: string; cachedInputTokens?: number; reasoningTokens?: number; reported?: boolean };
export function adminAIKey() {
  return typeof window === 'undefined' ? '' : window.localStorage.getItem('resumeos.openai.browser-key')?.trim() || '';
}
export async function structuredAI<T>(config: AIConfig, name: string, schema: z.ZodType<T>, instructions: string, input: unknown, maxOutputTokens: number): Promise<{ value: T; usage: AIUsage }> {
  if (!config.key) throw new Error('Save your OpenAI API key in Admin Settings before using AI.');
  if (!config.model.trim()) throw new Error('Choose an OpenAI model in Admin Settings.');
  const encoded = JSON.stringify(input);
  if (encoded.length > 160_000) throw new Error('This input is too large for one generation. Reduce unrelated candidate evidence or JD text.');
  const { $schema, ...jsonSchema } = z.toJSONSchema(schema);
  await config.observe?.({ status: 'dispatching' });
  const started = Date.now();
  let usage: AIUsage | undefined;
  let httpStatus: number | undefined;
  let outcome = 'network-or-timeout';
  try {
  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', signal: AbortSignal.timeout(150_000),
      headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, store: false, instructions, input: encoded,
        text: { format: { type: 'json_schema', name, strict: true, schema: jsonSchema } }, max_output_tokens: maxOutputTokens }),
    });
  } catch { throw new Error('OpenAI did not finish the request. No automatic retry was made; check usage before trying again.'); }
  httpStatus = response.status;
  outcome = 'http-error';
  if (!response.ok) {
    const message = response.status === 401 ? 'Reconnect your OpenAI key in Admin Settings.' : response.status === 429 ? 'OpenAI quota or rate limit reached. Check your account before retrying.' : 'Check model access and service availability in your OpenAI account.';
    throw new Error(`OpenAI request failed (${response.status}). ${message}`);
  }
  outcome = 'invalid-response';
  const body = await response.json() as { status?: string; output?: Array<{ content?: Array<{ type: string; text?: string }> }>; id?: string; usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number }; output_tokens_details?: { reasoning_tokens?: number } } };
  if (typeof body.usage?.input_tokens === 'number' && typeof body.usage.output_tokens === 'number') usage = { inputTokens: body.usage.input_tokens, outputTokens: body.usage.output_tokens, responseId: String(body.id ?? ''), ...(body.usage.input_tokens_details ? { cachedInputTokens: body.usage.input_tokens_details.cached_tokens ?? 0 } : {}), ...(body.usage.output_tokens_details ? { reasoningTokens: body.usage.output_tokens_details.reasoning_tokens ?? 0 } : {}) };
  outcome = 'incomplete';
  if (body.status !== 'completed') throw new Error('OpenAI returned an incomplete response. Nothing was saved; shorten the input or adjust the model.');
  const parts = (body.output ?? []).flatMap((item: { content?: Array<{ type: string; text?: string }> }) => item.content ?? []);
  outcome = 'refused';
  if (parts.some((part: { type: string }) => part.type === 'refusal')) throw new Error('OpenAI declined this request. Review the input before retrying.');
  const output = parts.filter(part => part.type === 'output_text').map(part => part.text ?? '').join('');
  let value: T;
  outcome = 'invalid-structured-output';
  try { value = schema.parse(JSON.parse(output)); }
  catch { throw new Error('OpenAI returned invalid structured data. Nothing was saved.'); }
  await config.observe?.({ status: 'completed', outcome: 'structured-output-received', ...(usage ? { usage } : {}), httpStatus, durationMs: Date.now() - started }).catch(() => { /* Dispatch record remains visible with unknown completion. */ });
  return { value, usage: usage ?? { inputTokens: 0, outputTokens: 0, responseId: String(body.id ?? ''), reported: false } };
  } catch (error) {
    await config.observe?.({ status: 'failed', outcome, ...(usage ? { usage } : {}), ...(httpStatus ? { httpStatus } : {}), durationMs: Date.now() - started }).catch(() => {});
    throw error;
  }
}
