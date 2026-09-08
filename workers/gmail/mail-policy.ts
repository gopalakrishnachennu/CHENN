export function parseSenders(value: unknown): string[] {
  if (typeof value !== 'string') throw new Error('Enter recruiter email addresses or domains.');
  const senders = [...new Set(value.split(/[,\n]/).map(x => x.trim().toLowerCase()).filter(Boolean))];
  if (!senders.length || senders.length > 30 || senders.some(x => !/^(?:[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@)?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(x))) throw new Error('Enter 1–30 valid recruiter email addresses or domains.');
  return senders;
}
export function senderAddress(from: string): string {
  return (from.match(/<([^<>]+)>/)?.[1] ?? from).trim().toLowerCase();
}
export function allowedSender(from: string, allowed: string[]) {
  const address = senderAddress(from); const domain = address.split('@')[1];
  return allowed.some(x => x.includes('@') ? x === address : x === domain);
}
export function classifyMail(subject: string, text: string): string | null {
  const all = `${subject}\n${text}`;
  // Authentication messages never enter the shared communications inbox.
  if (/\b(otp|one.time (?:pass|code)|verification code|security code|password reset|reset your password|sign.in code|authentication code)\b/i.test(all)) return null;
  if (/\b(interview|schedule a call|availability|assessment invitation)\b/i.test(all)) return 'Interview';
  if (/\b(offer letter|offer of employment|employment offer)\b/i.test(all)) return 'Offer';
  if (/\b(not moving forward|unfortunately|unsuccessful|other candidates)\b/i.test(all)) return 'Rejection';
  if (/\b(application received|received your application|thank you for applying|application submitted)\b/i.test(all)) return 'Confirmation';
  if (/\b(recruiter|recruiting|application|job opportunity|hiring|position)\b/i.test(all)) return 'Recruiter message';
  return null;
}
export function extractPlainText(payload: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }): string {
  let text = '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    const data = payload.body.data.replace(/-/g, '+').replace(/_/g, '/');
    text = new TextDecoder().decode(Uint8Array.from(atob(data), c => c.charCodeAt(0)));
  }
  for (const part of payload.parts ?? []) text += '\n' + extractPlainText(part as typeof payload);
  return text.slice(0, 16000);
}
