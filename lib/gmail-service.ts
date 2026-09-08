import type { User } from 'firebase/auth';

export async function provisionGmail(user: User, base: string | undefined, candidateId: string, email: string, enabled: boolean) {
  if (!base) return;
  const response = await fetch(`${base.replace(/\/$/, '')}/provision`, { method: 'POST', headers: { authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ candidateId, email, enabled }) });
  if (!response.ok) throw new Error('Gmail permissions could not be updated. Retry before changing candidate access.');
}
