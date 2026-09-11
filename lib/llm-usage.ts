import type { AIUsage } from './ai-client';
export type LLMUsageRecord = {
  id: string; stage: string; model: string; promptId?: string; promptVersion?: number;
  startedAt: string; finishedAt?: string; durationMs?: number;
  status: 'dispatching' | 'completed' | 'failed' | 'cache-hit';
  outcome?: string; httpStatus?: number; usage?: AIUsage; historical?: boolean; validationErrors?: string[];
};
export function usageSummary(records: LLMUsageRecord[]) {
  const seen = new Set<string>();
  const unique = records.filter(row => {
    const key = row.usage?.responseId || row.id;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const calls = unique.filter(r => r.status !== 'cache-hit');
  const measured = calls.filter(r => r.usage && r.usage.reported !== false);
  const durations = calls.filter(r => typeof r.durationMs === 'number').map(r => r.durationMs!);
  const input = measured.reduce((sum, row) => sum + row.usage!.inputTokens, 0);
  const output = measured.reduce((sum, row) => sum + row.usage!.outputTokens, 0);
  return { calls: calls.length, completed: calls.filter(r => r.status === 'completed').length, failed: calls.filter(r => r.status === 'failed').length,
    pending: calls.filter(r => r.status === 'dispatching').length, unknown: calls.filter(r => !r.usage || r.usage.reported === false).length,
    cacheHits: unique.filter(r => r.status === 'cache-hit').length, input, output, total: input + output,
    cachedInput: measured.reduce((sum, row) => sum + (row.usage!.cachedInputTokens ?? 0), 0),
    reasoning: measured.reduce((sum, row) => sum + (row.usage!.reasoningTokens ?? 0), 0),
    averageMs: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null };
}
