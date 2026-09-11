import { collection, doc, getDocs, getFirestore, setDoc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from './firebase';
import type { AIConfig, AIUsage } from './ai-client';
import type { LLMUsageRecord } from './llm-usage';
import type { WorkflowPrompt } from './workflow-prompts';
const db = getFirestore(firebaseApp, 'chenn');
export function trackedAI(config: AIConfig, prompt: WorkflowPrompt) {
  const id = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  return { ...config, usageId: id, observe: async (event: Parameters<NonNullable<AIConfig['observe']>>[0]) => {
    await setDoc(doc(db, 'llmUsage', id), { id, stage: prompt.stage, model: config.model, promptId: prompt.id, promptVersion: prompt.version, startedAt, ...event, ...(event.status !== 'dispatching' ? { finishedAt: new Date().toISOString() } : {}) }, { merge: true });
  } };
}
export async function recordOutcome(id: string, outcome: string, validationErrors: string[] = []) {
  await updateDoc(doc(db, 'llmUsage', id), { outcome, validationErrors }).catch(() => {});
}
export async function recordCacheHit(stage: string, model: string) {
  const id = crypto.randomUUID();
  await setDoc(doc(db, 'llmUsage', id), { id, stage, model, status: 'cache-hit', startedAt: new Date().toISOString() }).catch(() => {});
}
// Read-only recovery: old successful responses can be counted, but historical failures
// and cache hits cannot be reconstructed. Deduplicate by provider response ID.
export async function readLLMUsage(): Promise<LLMUsageRecord[]> {
  const [events, resumes, requests] = await Promise.all(['llmUsage', 'resumes', 'aiRequests'].map(name => getDocs(collection(db, name))));
  const rows = events.docs.map(d => ({ ...d.data(), id: d.id }) as LLMUsageRecord);
  const seen = new Set(rows.map(row => row.usage?.responseId).filter(Boolean));
  const add = (id: string, stage: string, usage: AIUsage | undefined, model: string, startedAt: string, outcome: string) => {
    if (!usage?.responseId || usage.reported === false || seen.has(usage.responseId)) return;
    seen.add(usage.responseId);
    rows.push({ id, stage, model, startedAt, status: 'completed', outcome, usage, historical: true });
  };
  for (const d of resumes.docs) { const r = d.data(); add(`historical-resume-${d.id}`, 'resume-generation', r.aiMetadata?.usage, r.generationSnapshot?.model || 'Unknown', r.createdAt || '', r.engine || 'historical'); }
  for (const d of requests.docs) { const r = d.data(); if (r.status === 'ready' && d.id.startsWith('jd_')) add(`historical-jd-${d.id}`, 'jd-normalization', r.result?.usage, r.result?.model || 'Unknown', r.result?.createdAt || (r.finishedAt ? new Date(r.finishedAt).toISOString() : ''), 'historical'); }
  return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
