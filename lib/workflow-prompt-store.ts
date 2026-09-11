import { doc, getDoc, getDocs, collection, runTransaction, getFirestore } from 'firebase/firestore';
import { firebaseApp } from './firebase';
import { defaultWorkflowPrompt, type PromptStage, type WorkflowPrompt } from './workflow-prompts';
const firebaseDb = getFirestore(firebaseApp, 'chenn');

export async function ensureWorkflowPrompts() {
  for (const stage of ['jd-normalization', 'resume-generation'] as const) {
    await runTransaction(firebaseDb, async tx => {
      const ref = doc(firebaseDb, 'prompts', stage);
      if ((await tx.get(ref)).exists()) return;
      const timestamp = new Date().toISOString();
      const prompt = { ...defaultWorkflowPrompt(stage), createdAt: timestamp, updatedAt: timestamp };
      tx.set(ref, prompt);
      tx.set(doc(ref, 'versions', '1'), prompt);
    });
  }
}
export async function publishedPrompt(stage: PromptStage): Promise<WorkflowPrompt> {
  const ref = doc(firebaseDb, 'prompts', stage);
  let snapshot = await getDoc(ref);
  if (!snapshot.exists()) { await ensureWorkflowPrompts(); snapshot = await getDoc(ref); }
  const prompt = snapshot.data() as WorkflowPrompt;
  if (!prompt?.active || !prompt.template?.trim()) throw new Error(`Publish the ${stage} prompt in Intelligence first.`);
  return prompt;
}
export async function publishWorkflowPrompt(stage: PromptStage, template: string, expectedVersion: number) {
  if (!['jd-normalization', 'resume-generation'].includes(stage)) throw new Error('Unknown prompt stage.');
  if (typeof template !== 'string' || template.trim().length < 80 || template.length > 24000) throw new Error('Prompt instructions must contain 80–24,000 characters.');
  return runTransaction(firebaseDb, async tx => {
    const ref = doc(firebaseDb, 'prompts', stage);
    const old = (await tx.get(ref)).data() as WorkflowPrompt | undefined;
    if ((old?.version ?? 0) !== expectedVersion) throw new Error('This prompt changed in another session. Refresh before publishing.');
    const timestamp = new Date().toISOString();
    const prompt = { ...defaultWorkflowPrompt(stage), template: template.trim(), version: (old?.version ?? 0) + 1, createdAt: old?.createdAt || timestamp, updatedAt: timestamp };
    tx.set(ref, prompt);
    tx.set(doc(ref, 'versions', String(prompt.version)), prompt);
    return prompt;
  });
}
export async function promptHistory(stage: PromptStage) {
  return (await getDocs(collection(firebaseDb, 'prompts', stage, 'versions'))).docs.map(d => d.data() as WorkflowPrompt).sort((a, b) => b.version - a.version);
}
