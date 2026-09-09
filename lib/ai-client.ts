import { z } from 'zod';

export type AIConfig = { key: string; model: string };
export type AIUsage = { inputTokens: number; outputTokens: number; responseId: string };
export function adminAIKey() {
  return typeof window === 'undefined' ? '' : window.localStorage.getItem('resumeos.openai.browser-key')?.trim() || '';
}
export async function structuredAI<T>(config: AIConfig, name: string, schema: z.ZodType<T>, instructions: string, input: unknown, maxOutputTokens: number): Promise<{ value: T; usage: AIUsage }> {
  if (!config.key) throw new Error('Save your OpenAI API key in Admin Settings before using AI.');
  if (!config.model.trim()) throw new Error('Choose an OpenAI model in Admin Settings.');
  const encoded = JSON.stringify(input);
  if (encoded.length > 160_000) throw new Error('This input is too large for one generation. Reduce unrelated candidate evidence or JD text.');
  const { $schema, ...jsonSchema } = z.toJSONSchema(schema);
  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', signal: AbortSignal.timeout(150_000),
      headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, store: false, instructions, input: encoded,
        text: { format: { type: 'json_schema', name, strict: true, schema: jsonSchema } }, max_output_tokens: maxOutputTokens }),
    });
  } catch { throw new Error('OpenAI did not finish the request. No automatic retry was made; check usage before trying again.'); }
  if (!response.ok) {
    const message = response.status === 401 ? 'Reconnect your OpenAI key in Admin Settings.' : response.status === 429 ? 'OpenAI quota or rate limit reached. Check your account before retrying.' : 'Check model access and service availability in your OpenAI account.';
    throw new Error(`OpenAI request failed (${response.status}). ${message}`);
  }
  const body = await response.json() as { status?: string; output?: Array<{ content?: Array<{ type: string; text?: string }> }>; id?: string; usage?: { input_tokens?: number; output_tokens?: number } };
  if (body.status !== 'completed') throw new Error('OpenAI returned an incomplete response. Nothing was saved; shorten the input or adjust the model.');
  const parts = (body.output ?? []).flatMap((item: { content?: Array<{ type: string; text?: string }> }) => item.content ?? []);
  if (parts.some((part: { type: string }) => part.type === 'refusal')) throw new Error('OpenAI declined this request. Review the input before retrying.');
  const output = parts.filter(part => part.type === 'output_text').map(part => part.text ?? '').join('');
  let value: T;
  try { value = schema.parse(JSON.parse(output)); }
  catch { throw new Error('OpenAI returned invalid structured data. Nothing was saved.'); }
  return { value, usage: { inputTokens: Number(body.usage?.input_tokens ?? 0), outputTokens: Number(body.usage?.output_tokens ?? 0), responseId: String(body.id ?? '') } };
}
