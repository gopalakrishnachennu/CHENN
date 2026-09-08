import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { allowedSender, classifyMail, extractPlainText, parseSenders } from '../workers/gmail/mail-policy';
import worker, { seal, unseal, synchronize, type Env } from '../workers/gmail/index';

vi.mock('jose', () => ({ createRemoteJWKSet: () => ({}), jwtVerify: async (token: string) => {
  if (token === 'invalid') throw new Error('Invalid signature');
  return { payload: { sub: token, email_verified: true, email: token === 'admin' ? 'admin@example.com' : `${token}@example.com` } };
} }));
const secret = btoa('12345678901234567890123456789012');
let sqlite: DatabaseSync;
let env: Env;
function dbAdapter(database: DatabaseSync): D1Database {
  const prepare = (sql: string, args: unknown[] = []) => ({
    bind: (...bindings: unknown[]) => prepare(sql, bindings),
    first: async () => database.prepare(sql).get(...args as never[]) ?? null,
    all: async () => ({ results: database.prepare(sql).all(...args as never[]) }),
    run: async () => database.prepare(sql).run(...args as never[]),
  });
  return { prepare, batch: async (items: { run: () => Promise<unknown> }[]) => Promise.all(items.map(i => i.run())) } as unknown as D1Database;
}
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:'); sqlite.exec(readFileSync('workers/gmail/migrations/0001_gmail.sql', 'utf8'));
  env = { GMAIL_DB: dbAdapter(sqlite), GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'secret', TOKEN_ENCRYPTION_KEY: secret, FIREBASE_PROJECT_ID: 'test', FIREBASE_DATABASE_ID: 'chenn', PORTAL_ORIGIN: 'https://chenn.web.app', ADMIN_EMAIL: 'admin@example.com' };
});
afterEach(() => { sqlite.close(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function seed() {
  sqlite.prepare('INSERT INTO candidate_permissions VALUES(?,?,?,?)').run('candidate', 'candidate@example.com', 1, new Date().toISOString());
  sqlite.prepare('INSERT INTO connections(id,owner_uid,email,token,senders,history_id,consent_at,consent_version,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run('candidate', 'candidate', 'candidate@example.com', await seal('refresh-secret', secret), '["acme.com"]', '10', new Date().toISOString(), 'v1', new Date().toISOString());
}
const readConnection = () => sqlite.prepare('SELECT * FROM connections').get()!;
describe('Email processing and encrypted credentials', () => {
  it('matches exact senders and domains, rejecting lookalikes', () => { expect(allowedSender('Hiring <hr@acme.com>', ['acme.com'])).toBe(true); expect(allowedSender('hr@notacme.com', ['acme.com'])).toBe(false); expect(allowedSender('hr@acme.com.evil.org', ['acme.com'])).toBe(false); expect(() => parseSenders('*')).toThrow(); });
  it('rejects OTP messages and ignores unrelated mail', () => { expect(classifyMail('Interview verification code', 'Your one-time code is 1234')).toBeNull(); expect(classifyMail('Groceries', 'Milk')).toBeNull(); expect(classifyMail('Interview invitation', '')).toBe('Interview'); });
  it('decodes UTF-8 MIME and ignores HTML execution', () => { const value = 'Interview — Thursday'; const data = btoa(String.fromCharCode(...new TextEncoder().encode(value))); expect(extractPlainText({ mimeType: 'text/plain', body: { data } })).toBe(value); expect(extractPlainText({ mimeType: 'text/html', body: { data: btoa('<script>alert(1)</script>') } })).toBe(''); });
  it('encrypts randomly and fails authentication for a different key', async () => { const a = await seal('credential', secret); const b = await seal('credential', secret); expect(a).not.toBe(b); expect(a).not.toContain('credential'); expect(await unseal(a, secret)).toBe('credential'); await expect(unseal(a, btoa('abcdefghijklmnopqrstuvwxyz123456'))).rejects.toThrow(); });
});
describe('Gmail synchronization', () => {
  it.each(['paused', 'reconnected'])('does not overwrite a connection %s during a sync', async (change) => {
    await seed();
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (input.includes('/token')) return Response.json({ access_token: 'access' });
      if (input.includes('/history?')) {
        if (change === 'paused') sqlite.prepare("UPDATE connections SET status='paused'").run();
        else sqlite.prepare("UPDATE connections SET consent_at='new-consent',history_id='99'").run();
        return Response.json({ historyId: '20', history: [{ id: '20', messagesAdded: [{ message: { id: 'mail1' } }] }] });
      }
      return Response.json({ threadId: 'thread', internalDate: String(Date.now()), payload: { mimeType: 'text/plain', headers: [{ name: 'From', value: 'hr@acme.com' }, { name: 'Subject', value: 'Interview invitation' }], body: { data: btoa('Interview on Monday') } } });
    }));
    await synchronize(env, 'candidate');
    expect(readConnection().history_id).toBe(change === 'paused' ? '10' : '99');
    expect(sqlite.prepare('SELECT count(*) AS count FROM messages').get()?.count).toBe(0);
  });
  it('stores relevant mail exactly once and advances cursor after persistence', async () => {
    await seed();
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (input.includes('/token')) return Response.json({ access_token: 'access' });
      if (input.includes('/history?')) return Response.json({ historyId: '20', history: [{ id: '20', messagesAdded: [{ message: { id: 'mail1' } }] }] });
      return Response.json({ id: 'mail1', threadId: 'thread', internalDate: String(Date.now()), payload: { mimeType: 'text/plain', headers: [{ name: 'From', value: 'hr@acme.com' }, { name: 'Subject', value: 'Interview invitation' }], body: { data: btoa('Interview on Monday') } } });
    }));
    await synchronize(env, 'candidate'); await synchronize(env, 'candidate');
    expect(sqlite.prepare('SELECT count(*) AS count FROM messages').get()?.count).toBe(1); expect(readConnection().history_id).toBe('20'); expect(readConnection().last_error).toBeNull();
  });
  it('does not advance a cursor after transient Google errors', async () => {
    await seed(); vi.stubGlobal('fetch', vi.fn(async (input: string) => input.includes('/token') ? Response.json({ access_token: 'access' }) : new Response('', { status: 503 })));
    await synchronize(env, 'candidate'); expect(readConnection().history_id).toBe('10'); expect(readConnection().failures).toBe(1); expect(readConnection().lease_until).toBe(0);
  });
  it('marks revoked credentials as reconnect required', async () => {
    await seed(); vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 400 })));
    await synchronize(env, 'candidate'); expect(readConnection().status).toBe('reconnect');
  });
  it('does not process a paused or disabled connection', async () => {
    await seed(); sqlite.prepare("UPDATE connections SET status='paused'").run(); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await synchronize(env, 'candidate'); expect(fetcher).not.toHaveBeenCalled();
    sqlite.prepare("UPDATE connections SET status='connected'").run(); sqlite.prepare('UPDATE candidate_permissions SET enabled=0').run(); await synchronize(env, 'candidate'); expect(fetcher).not.toHaveBeenCalled(); expect(readConnection().status).toBe('paused');
  });
  it('exposes history gaps instead of pretending synchronization is healthy', async () => {
    await seed(); vi.stubGlobal('fetch', vi.fn(async (input: string) => input.includes('/token') ? Response.json({ access_token: 'access' }) : new Response('', { status: 404 })));
    await synchronize(env, 'candidate'); expect(readConnection().status).toBe('reconnect'); expect(readConnection().last_error).toContain('older messages may be missing');
  });
  it('does not read message bodies for unapproved senders', async () => {
    await seed(); const calls: string[] = []; vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      calls.push(input); if (input.includes('/token')) return Response.json({ access_token: 'access' });
      if (input.includes('/history?')) return Response.json({ historyId: '20', history: [{ id: '20', messagesAdded: [{ message: { id: 'private' } }] }] });
      return Response.json({ payload: { headers: [{ name: 'From', value: 'friend@example.org' }] } });
    })); await synchronize(env, 'candidate'); expect(calls.some(c => c.includes('format=full'))).toBe(false); expect(sqlite.prepare('SELECT count(*) AS count FROM messages').get()?.count).toBe(0);
  });
});
describe('HTTP access boundaries', () => {
  it('denies anonymous and invalid tokens', async () => { expect((await worker.fetch(new Request('https://gmail.test/mail?candidateId=candidate'), env)).status).toBe(401); expect((await worker.fetch(new Request('https://gmail.test/mail?candidateId=candidate', { headers: { authorization: 'Bearer invalid' } }), env)).status).toBe(401); });
  it('denies unrelated origins', async () => { expect((await worker.fetch(new Request('https://gmail.test/mail', { headers: { origin: 'https://evil.test' } }), env)).status).toBe(403); });
  it('does not expose tokens through admin connection status', async () => { await seed(); const response = await worker.fetch(new Request('https://gmail.test/connections', { headers: { authorization: 'Bearer admin' } }), env); const text = await response.text(); expect(response.status).toBe(200); expect(text).not.toContain('refresh-secret'); expect(text).not.toContain('"token"'); });
  it('blocks a candidate from listing everyone’s mailboxes', async () => { const response = await worker.fetch(new Request('https://gmail.test/connections', { headers: { authorization: 'Bearer candidate' } }), env); expect(response.status).toBe(403); });
  it('rejects a candidate whose profile email does not match', async () => { vi.stubGlobal('fetch', async () => Response.json({ fields: { email: { stringValue: 'other@example.com' }, portalEnabled: { booleanValue: true }, status: { stringValue: 'Active' } } })); const response = await worker.fetch(new Request('https://gmail.test/mail?candidateId=candidate', { headers: { authorization: 'Bearer candidate' } }), env); expect(response.status).toBe(403); });
  it('consumes expired/invalid OAuth states without accepting the callback', async () => { const response = await worker.fetch(new Request('https://gmail.test/oauth/callback?state=invalid&code=code'), env); expect(response.status).toBe(303); expect(response.headers.get('location')).toContain('gmail=failed'); });
});
