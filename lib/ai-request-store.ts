import { doc, getFirestore, runTransaction } from 'firebase/firestore';
import { firebaseApp } from './firebase';

// External calls must never run inside a retryable Firestore transaction.
export async function cachedAIRequest<T>(id: string, producer: () => Promise<T>, onCacheHit?: () => Promise<void>): Promise<T> {
  const db = getFirestore(firebaseApp, 'chenn');
  const ref = doc(db, 'aiRequests', id);
  const attempt = crypto.randomUUID();
  const ready = await runTransaction(db, async tx => {
    const snap = await tx.get(ref); const value = snap.data();
    if (value?.status === 'ready') return { result: value.result as T };
    if (value?.status === 'running' && Date.now() - value.startedAt < 5 * 60_000) throw new Error('This AI request is already running. Wait before trying again.');
    tx.set(ref, { status: 'running', attempt, startedAt: Date.now() });
    return null;
  });
  if (ready) { await onCacheHit?.(); return ready.result; }
  try {
    const result = await producer();
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (snap.data()?.attempt !== attempt) throw new Error('AI request ownership changed. Refresh before retrying.');
      tx.set(ref, { status: 'ready', attempt, result, finishedAt: Date.now() });
    });
    return result;
  } catch (error) {
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (snap.data()?.attempt === attempt) tx.set(ref, { status: 'failed', attempt, finishedAt: Date.now() });
    }).catch(() => {});
    throw error;
  }
}
