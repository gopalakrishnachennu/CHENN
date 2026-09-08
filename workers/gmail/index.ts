import { createRemoteJWKSet, jwtVerify } from 'jose';
import { allowedSender, classifyMail, extractPlainText, parseSenders } from './mail-policy';

export interface Env {
  GMAIL_DB: D1Database; GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string;
  TOKEN_ENCRYPTION_KEY: string; FIREBASE_PROJECT_ID: string; FIREBASE_DATABASE_ID: string;
  PORTAL_ORIGIN: string; ADMIN_EMAIL: string;
}
type Connection = { id: string; owner_uid: string; email: string; token: string; senders: string; status: string;
  history_id: string | null; last_sync: string | null; last_error: string | null; failures: number; consent_at: string; consent_version: string };
type GmailResult = {
  id?: string; threadId: string; internalDate: string; historyId: string; nextPageToken?: string;
  history?: Array<{ id: string; messagesAdded?: Array<{ message: { id: string } }> }>;
  payload?: { mimeType?: string; body?: { data?: string }; parts?: unknown[]; headers?: Array<{ name: string; value: string }> };
};
const firebaseKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const iso = () => new Date().toISOString();
const epoch = () => Math.floor(Date.now() / 1000);
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const decode = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const json = (data: unknown, status = 200) => Response.json(data, { status });
class ApiError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
class ReconnectError extends Error {}
class YieldSync extends Error {}

export async function seal(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', decode(secret), 'AES-GCM', false, ['encrypt']);
  const bytes = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
  return `${encode(iv)}.${encode(new Uint8Array(bytes))}`;
}
export async function unseal(value: string, secret: string) {
  const [iv, ciphertext] = value.split('.');
  const key = await crypto.subtle.importKey('raw', decode(secret), 'AES-GCM', false, ['decrypt']);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv) }, key, decode(ciphertext)));
}
async function identity(request: Request, env: Env) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!bearer) throw new ApiError('Sign in to continue.', 401);
  try {
    const { payload } = await jwtVerify(bearer, firebaseKeys, { issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`, audience: env.FIREBASE_PROJECT_ID, algorithms: ['RS256'] });
    if (!payload.sub || payload.email_verified !== true || typeof payload.email !== 'string') throw new Error();
    return { uid: payload.sub, email: payload.email.toLowerCase(), bearer, admin: payload.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase() };
  } catch { throw new ApiError('Your sign-in has expired. Sign in again.', 401); }
}
async function candidateAccess(id: string, user: Awaited<ReturnType<typeof identity>>, env: Env, requireOwner = false) {
  if (!/^[\w-]{1,150}$/.test(id)) throw new ApiError('Invalid candidate.');
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/${env.FIREBASE_DATABASE_ID}/documents/candidates/${id}`;
  const result = await fetch(url, { headers: { authorization: `Bearer ${user.bearer}` } });
  if (!result.ok) throw new ApiError('Candidate access denied.', 403);
  const { fields } = await result.json() as { fields: Record<string, { stringValue?: string; booleanValue?: boolean }> };
  const owner = fields.email?.stringValue?.toLowerCase() === user.email;
  if ((!owner && (!user.admin || requireOwner)) || (owner && (fields.portalEnabled?.booleanValue !== true || fields.status?.stringValue === 'Archived'))) throw new ApiError('Candidate access denied.', 403);
}
async function log(env: Env, id: string, actor: string, action: string) {
  await env.GMAIL_DB.prepare('INSERT INTO audit(id,candidate_id,actor,action,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(), id, actor, action, iso()).run();
}
function safeConnection(c: Connection) {
  return { id: c.id, email: c.email, senders: JSON.parse(c.senders), status: c.status, lastSync: c.last_sync, lastError: c.last_error, consentAt: c.consent_at };
}
async function requestToken(env: Env, form: Record<string, string>) {
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, ...form }) });
  if (!response.ok) { if (response.status === 400) throw new ReconnectError('Reconnect Gmail.'); throw new Error('Google authorization is temporarily unavailable.'); }
  return response.json() as Promise<{ access_token: string; refresh_token?: string; id_token?: string; scope?: string }>;
}
async function googleGet(path: string, token: string) {
  const result = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (result.status === 404) throw new ApiError('History expired', 404);
  if (result.status === 401 || result.status === 403) throw new ReconnectError('Gmail access needs attention. Reconnect Gmail.');
  if (!result.ok) throw new Error('Gmail is temporarily unavailable; synchronization will retry.');
  return result.json() as Promise<GmailResult>;
}
async function ingest(env: Env, c: Connection, token: string, ids: string[], budget: { remaining: number }) {
  for (const id of new Set(ids)) {
    const exists = await env.GMAIL_DB.prepare('SELECT message_id FROM processed_messages WHERE candidate_id=? AND message_id=?').bind(c.id, id).first();
    if (exists) continue;
    const processed = () => env.GMAIL_DB.prepare('INSERT OR IGNORE INTO processed_messages(candidate_id,message_id,processed_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM connections WHERE id=?)').bind(c.id, id, iso(), c.id).run();
    if (--budget.remaining <= 0) throw new YieldSync();
    let metadata;
    try { metadata = await googleGet(`messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`, token); }
    catch (e) { if (e instanceof ApiError && e.status === 404) { await processed(); continue; } throw e; }
    const from = String(metadata.payload?.headers?.find((h: { name: string }) => h.name.toLowerCase() === 'from')?.value ?? '');
    if (!allowedSender(from, JSON.parse(c.senders))) { await processed(); continue; }
    if (--budget.remaining <= 0) throw new YieldSync();
    let message;
    try { message = await googleGet(`messages/${encodeURIComponent(id)}?format=full`, token); }
    catch (e) { if (e instanceof ApiError && e.status === 404) { await processed(); continue; } throw e; }
    const headers = message.payload?.headers ?? [];
    const header = (name: string) => String(headers.find((h: { name: string }) => h.name.toLowerCase() === name)?.value ?? '');
    if (!allowedSender(header('from'), JSON.parse(c.senders))) continue;
    const text = extractPlainText(message.payload ?? {});
    const category = classifyMail(header('subject'), text);
    if (!category) { await processed(); continue; }
    const received = new Date(Number(message.internalDate));
    await env.GMAIL_DB.prepare("INSERT OR IGNORE INTO messages(id,candidate_id,thread_id,sender,subject,received_at,category,preview) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM connections WHERE id=? AND status='connected' AND senders=? AND consent_at=?)")
      .bind(id, c.id, message.threadId, header('from').slice(0, 500), header('subject').slice(0, 500), received.toISOString(), category, text.slice(0, 2000), c.id, c.senders, c.consent_at).run();
    await processed();
  }
}
export async function synchronize(env: Env, candidateId: string, budget = { remaining: 10 }) {
  const now = epoch();
  // Durable lease prevents overlapping cron/manual runs; recheck state before every write.
  const c = await env.GMAIL_DB.prepare("UPDATE connections SET lease_until=? WHERE id=? AND status='connected' AND lease_until<? RETURNING *").bind(now + 180, candidateId, now).first<Connection>();
  if (!c) return;
  try {
    const permission = await env.GMAIL_DB.prepare('SELECT enabled,email FROM candidate_permissions WHERE candidate_id=?').bind(candidateId).first<{ enabled: number; email: string }>();
    if (!permission?.enabled || permission.email !== c.email) {
      await env.GMAIL_DB.prepare("UPDATE connections SET status='paused',last_error='Administrator disabled Gmail synchronization.',lease_until=0 WHERE id=?").bind(candidateId).run();
      return;
    }
    budget.remaining--;
    const tokens = await requestToken(env, { grant_type: 'refresh_token', refresh_token: await unseal(c.token, env.TOKEN_ENCRYPTION_KEY) });
    if (tokens.refresh_token) await env.GMAIL_DB.prepare('UPDATE connections SET token=? WHERE id=? AND consent_at=?').bind(await seal(tokens.refresh_token, env.TOKEN_ENCRYPTION_KEY), c.id, c.consent_at).run();
    if (!c.history_id) {
      const profile = await googleGet('profile', tokens.access_token);
      // Start at consent time, without silently importing historical personal mail.
      await env.GMAIL_DB.prepare("UPDATE connections SET history_id=?,last_sync=?,last_error=NULL,failures=0,next_sync=?,lease_until=0 WHERE id=? AND status='connected' AND consent_at=?").bind(profile.historyId, iso(), epoch() + 300, c.id, c.consent_at).run();
      return;
    }
    budget.remaining--;
    const history = await googleGet(`history?startHistoryId=${encodeURIComponent(c.history_id)}&historyTypes=messageAdded&maxResults=10`, tokens.access_token);
    const entries = history.history ?? [];
    // Commit each history cursor only after all its messages are persisted.
    for (const event of entries) {
      const ids = (event.messagesAdded ?? []).map((m: { message: { id: string } }) => m.message.id);
      await ingest(env, c, tokens.access_token, ids, budget);
      await env.GMAIL_DB.prepare("UPDATE connections SET history_id=? WHERE id=? AND status='connected' AND consent_at=?").bind(event.id, c.id, c.consent_at).run();
    }
    if (!history.nextPageToken) await env.GMAIL_DB.prepare("UPDATE connections SET history_id=? WHERE id=? AND status='connected' AND consent_at=?").bind(history.historyId, c.id, c.consent_at).run();
    await env.GMAIL_DB.prepare("UPDATE connections SET last_sync=?,failures=0,last_error=NULL,next_sync=?,lease_until=0 WHERE id=? AND status='connected' AND consent_at=?").bind(iso(), epoch() + (history.nextPageToken ? 0 : 300), c.id, c.consent_at).run();
  } catch (e) {
    if (e instanceof YieldSync) { await env.GMAIL_DB.prepare('UPDATE connections SET lease_until=0,next_sync=? WHERE id=? AND consent_at=?').bind(epoch(), c.id, c.consent_at).run(); return; }
    const reconnect = e instanceof ReconnectError;
    const expired = e instanceof ApiError && e.status === 404;
    // History gaps are visible and require explicit reconnection, never silently marked healthy.
    const status = reconnect || expired ? 'reconnect' : 'connected';
    const message = expired ? 'Sync history expired. Reconnect to restart from now; older messages may be missing.' : reconnect ? 'Google access expired or was revoked. Reconnect Gmail.' : 'Sync failed. Automatic retry scheduled.';
    await env.GMAIL_DB.prepare("UPDATE connections SET status=?,last_error=?,failures=failures+1,next_sync=?,lease_until=0 WHERE id=? AND status='connected' AND consent_at=?").bind(status, message, epoch() + Math.min(3600, 300 * 2 ** Math.min(c.failures, 4)), c.id, c.consent_at).run();
  }
}
async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/health') return json({ configured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.TOKEN_ENCRYPTION_KEY && env.GMAIL_DB) });
  if (url.pathname === '/oauth/callback') {
    const state = url.searchParams.get('state') || '';
    const pending = await env.GMAIL_DB.prepare('DELETE FROM oauth_states WHERE id=? AND expires>? RETURNING *').bind(state, epoch()).first<{ candidate_id: string; owner_uid: string; email: string; senders: string; verifier: string }>();
    let outcome = 'failed';
    if (pending && url.searchParams.has('code')) {
      try {
        const permission = await env.GMAIL_DB.prepare('SELECT enabled,email FROM candidate_permissions WHERE candidate_id=?').bind(pending.candidate_id).first<{ enabled: number; email: string }>();
        if (!permission?.enabled || permission.email !== pending.email) throw new Error('Sharing disabled');
        const tokens = await requestToken(env, { grant_type: 'authorization_code', code: url.searchParams.get('code')!, redirect_uri: `${url.origin}/oauth/callback`, code_verifier: pending.verifier });
        if (!tokens.id_token || !tokens.refresh_token || !tokens.scope?.includes('https://www.googleapis.com/auth/gmail.readonly')) throw new Error('Missing permission');
        const { payload } = await jwtVerify(tokens.id_token, googleKeys, { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: env.GOOGLE_CLIENT_ID, algorithms: ['RS256'] });
        if (payload.email_verified !== true || payload.email !== pending.email) throw new Error('Wrong account');
        const profile = await googleGet('profile', tokens.access_token);
        const existing = await env.GMAIL_DB.prepare('SELECT owner_uid FROM connections WHERE id=?').bind(pending.candidate_id).first<{ owner_uid: string }>();
        if (existing && existing.owner_uid !== pending.owner_uid) throw new Error('Account ownership changed');
        await env.GMAIL_DB.prepare("INSERT INTO connections(id,owner_uid,email,token,senders,status,history_id,consent_at,consent_version,created_at) VALUES(?,?,?,?,?,'connected',?,?,?,?) ON CONFLICT(id) DO UPDATE SET token=excluded.token,senders=excluded.senders,status='connected',history_id=excluded.history_id,last_error=NULL,failures=0,next_sync=0,consent_at=excluded.consent_at")
          .bind(pending.candidate_id, pending.owner_uid, pending.email, await seal(tokens.refresh_token, env.TOKEN_ENCRYPTION_KEY), pending.senders, profile.historyId, iso(), 'job-mail-v1', iso()).run();
        await log(env, pending.candidate_id, pending.email, 'gmail.connected'); outcome = 'connected';
      } catch { outcome = 'failed'; }
    }
    return Response.redirect(`${env.PORTAL_ORIGIN}/?gmail=${outcome}#candidate/overview`, 303);
  }
  const user = await identity(request, env);
  if (url.pathname === '/provision' && request.method === 'POST') {
    if (!user.admin) throw new ApiError('Administrator access required.', 403);
    const body = await request.json() as { candidateId: string; email: string; enabled: boolean };
    await candidateAccess(body.candidateId, user, env);
    await env.GMAIL_DB.prepare('INSERT INTO candidate_permissions(candidate_id,email,enabled,updated_at) VALUES(?,?,?,?) ON CONFLICT(candidate_id) DO UPDATE SET email=excluded.email,enabled=excluded.enabled,updated_at=excluded.updated_at').bind(body.candidateId, body.email.toLowerCase(), body.enabled ? 1 : 0, iso()).run();
    if (!body.enabled) await env.GMAIL_DB.prepare("UPDATE connections SET status='paused' WHERE id=?").bind(body.candidateId).run();
    return json({ ok: true });
  }
  if (url.pathname === '/connections' && request.method === 'GET') {
    if (!user.admin) throw new ApiError('Administrator access required.', 403);
    const { results } = await env.GMAIL_DB.prepare('SELECT * FROM connections ORDER BY created_at DESC LIMIT 500').all<Connection>();
    return json({ connections: results.map(safeConnection) });
  }
  const id = url.searchParams.get('candidateId') || '';
  await candidateAccess(id, user, env, url.pathname === '/connect');
  if (url.pathname === '/connect' && request.method === 'POST') {
    const permission = await env.GMAIL_DB.prepare('SELECT enabled,email FROM candidate_permissions WHERE candidate_id=?').bind(id).first<{ enabled: number; email: string }>();
    if (!permission?.enabled || permission.email !== user.email) throw new ApiError('Ask the administrator to enable Gmail for your candidate profile.');
    const body = await request.json() as { senders?: string; consent?: boolean };
    if (body.consent !== true) throw new ApiError('Confirm sharing consent.');
    const senders = parseSenders(body.senders);
    const state = encode(crypto.getRandomValues(new Uint8Array(32))); const verifier = encode(crypto.getRandomValues(new Uint8Array(32)));
    await env.GMAIL_DB.prepare('INSERT INTO oauth_states(id,candidate_id,owner_uid,email,senders,verifier,expires) VALUES(?,?,?,?,?,?,?)').bind(state, id, user.uid, user.email, JSON.stringify(senders), verifier, epoch() + 600).run();
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    auth.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: `${url.origin}/oauth/callback`, response_type: 'code', scope: 'openid email https://www.googleapis.com/auth/gmail.readonly', access_type: 'offline', prompt: 'consent', login_hint: user.email, state, code_challenge: encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))), code_challenge_method: 'S256' }).toString();
    return json({ url: auth.toString() });
  }
  const c = await env.GMAIL_DB.prepare('SELECT * FROM connections WHERE id=?').bind(id).first<Connection>();
  if (!c) return json({ connection: null, messages: [] });
  if (!user.admin && c.owner_uid !== user.uid) throw new ApiError('Connection ownership mismatch.', 403);
  if (request.method === 'GET' && url.pathname === '/mail') {
    const { results } = await env.GMAIL_DB.prepare('SELECT * FROM messages WHERE candidate_id=? ORDER BY received_at DESC LIMIT 100').bind(id).all();
    await log(env, id, user.email, user.admin ? 'gmail.admin_view' : 'gmail.candidate_view');
    return json({ connection: safeConnection(c), messages: results });
  }
  if (request.method !== 'POST') throw new ApiError('Not found.', 404);
  if (url.pathname === '/sync') { await synchronize(env, id); return json({ ok: true }); }
  if (url.pathname === '/pause') {
    await env.GMAIL_DB.prepare("UPDATE connections SET status='paused' WHERE id=?").bind(id).run();
  } else if (url.pathname === '/resume') {
    if (user.uid !== c.owner_uid) throw new ApiError('Only the candidate can resume sharing.', 403);
    if (c.status === 'reconnect') throw new ApiError('Reconnect Gmail first.');
    const permission = await env.GMAIL_DB.prepare('SELECT enabled,email FROM candidate_permissions WHERE candidate_id=?').bind(id).first<{ enabled: number; email: string }>();
    if (!permission?.enabled || permission.email !== c.email) throw new ApiError('Administrator disabled Gmail synchronization.', 403);
    const tokens = await requestToken(env, { grant_type: 'refresh_token', refresh_token: await unseal(c.token, env.TOKEN_ENCRYPTION_KEY) });
    const profile = await googleGet('profile', tokens.access_token);
    await env.GMAIL_DB.prepare("UPDATE connections SET status='connected',history_id=?,next_sync=0,lease_until=0,consent_at=? WHERE id=?").bind(profile.historyId, iso(), id).run();
  } else if (url.pathname === '/disconnect') {
    if (user.uid !== c.owner_uid) throw new ApiError('Only the candidate can disconnect Gmail.', 403);
    await env.GMAIL_DB.prepare("UPDATE connections SET status='paused' WHERE id=?").bind(id).run();
    const revoke = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', body: new URLSearchParams({ token: await unseal(c.token, env.TOKEN_ENCRYPTION_KEY) }) });
    if (!revoke.ok && revoke.status !== 400) throw new ApiError('Sharing paused. Google revocation failed; retry disconnect.');
    await env.GMAIL_DB.batch([env.GMAIL_DB.prepare('DELETE FROM messages WHERE candidate_id=?').bind(id), env.GMAIL_DB.prepare('DELETE FROM connections WHERE id=?').bind(id)]);
  } else if (url.pathname === '/sharing') {
    if (user.uid !== c.owner_uid) throw new ApiError('Only the candidate can change sharing.', 403);
    const body = await request.json() as { senders: string };
    const senders = parseSenders(body.senders);
    await env.GMAIL_DB.prepare('UPDATE connections SET senders=? WHERE id=?').bind(JSON.stringify(senders), id).run();
    // Remove previously shared messages outside the updated allowlist.
    const { results } = await env.GMAIL_DB.prepare('SELECT id,sender FROM messages WHERE candidate_id=?').bind(id).all<{ id: string; sender: string }>();
    for (const message of results) if (!allowedSender(message.sender, senders)) await env.GMAIL_DB.prepare('DELETE FROM messages WHERE candidate_id=? AND id=?').bind(id, message.id).run();
  } else throw new ApiError('Not found.', 404);
  await log(env, id, user.email, `gmail.${url.pathname.slice(1)}`);
  return json({ ok: true });
}
export default {
  async fetch(request: Request, env: Env) {
    const origin = request.headers.get('origin');
    const headers = { 'Access-Control-Allow-Origin': env.PORTAL_ORIGIN, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Vary': 'Origin', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
    if (origin && origin !== env.PORTAL_ORIGIN) return json({ error: 'Origin denied.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    let result: Response;
    try { result = await handle(request, env); }
    catch (e) { result = json({ error: e instanceof ApiError || e instanceof ReconnectError ? e.message : 'Gmail service could not complete this request.' }, e instanceof ApiError ? e.status : 503); }
    const response = new Response(result.body, result); for (const [k, v] of Object.entries(headers)) response.headers.set(k, v); return response;
  },
  async scheduled(_event: ScheduledController, env: Env) {
    const { results } = await env.GMAIL_DB.prepare("SELECT id FROM connections WHERE status='connected' AND next_sync<=? AND lease_until<? ORDER BY next_sync LIMIT 1").bind(epoch(), epoch()).all<{ id: string }>();
    for (const row of results) await synchronize(env, row.id);
    await env.GMAIL_DB.prepare('DELETE FROM oauth_states WHERE expires<?').bind(epoch()).run();
    await env.GMAIL_DB.prepare('DELETE FROM messages WHERE received_at<?').bind(new Date(Date.now() - 90 * 86400000).toISOString()).run();
    await env.GMAIL_DB.prepare('DELETE FROM audit WHERE created_at<?').bind(new Date(Date.now() - 180 * 86400000).toISOString()).run();
    await env.GMAIL_DB.prepare('DELETE FROM processed_messages WHERE processed_at<?').bind(new Date(Date.now() - 30 * 86400000).toISOString()).run();
  },
};
