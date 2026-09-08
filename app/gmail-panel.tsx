'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePlatform } from '@/lib/platform-context';
import { provisionGmail } from '@/lib/gmail-service';

type Connection = { id: string; email: string; senders: string[]; status: string; lastSync: string | null; lastError: string | null; consentAt: string };
type Message = { id: string; sender: string; subject: string; received_at: string; category: string; preview: string };
export function GmailPanel({ candidateId, admin = false }: { candidateId?: string; admin?: boolean }) {
  const { state, user, act } = usePlatform();
  const [service, setService] = useState(state?.settings.gmailServiceUrl ?? '');
  const [selectedId, setSelectedId] = useState(candidateId ?? state?.candidates[0]?.id ?? '');
  const [connections, setConnections] = useState<Connection[]>([]); const [connection, setConnection] = useState<Connection | null>(null);
  const [messages, setMessages] = useState<Message[]>([]); const [senders, setSenders] = useState(''); const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const loadVersion = useRef(0);
  const base = state?.settings.gmailServiceUrl?.replace(/\/$/, '');
  const call = useCallback(async (path: string, body?: unknown) => {
    if (!base || !user) throw new Error('Gmail integration has not been configured by the administrator.');
    const response = await fetch(`${base}${path}${path.includes('?') ? '&' : '?'}candidateId=${encodeURIComponent(selectedId)}`, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json() as { error?: string; connection: Connection | null; messages: Message[]; connections: Connection[]; url: string };
    if (!response.ok) throw new Error(result.error || 'Gmail request failed.'); return result;
  }, [base, user, selectedId]);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    try {
      const result = await call('/mail');
      const all = admin ? await call('/connections') : null;
      if (version !== loadVersion.current) return;
      setConnection(result.connection); setMessages(result.messages ?? []);
      setSenders((result.connection?.senders ?? []).join(', '));
      if (all) setConnections(all.connections);
    } catch (e) { if (version === loadVersion.current) throw e; }
  }, [call, admin]);
  useEffect(() => { setConnection(null); setMessages([]); setSenders(''); setConsent(false); setNotice(''); setError(''); if (base && selectedId) void load().catch(e => setError(e.message)); return () => { loadVersion.current++; }; }, [base, selectedId, load]);
  useEffect(() => { const url = new URL(window.location.href); const result = url.searchParams.get('gmail'); if (result) { if (result === 'connected') setNotice('Gmail connected. New matching job emails will appear after synchronization.'); else setError('Gmail was not connected. Use the same Google account as your portal sign-in and approve the requested permission.'); url.searchParams.delete('gmail'); window.history.replaceState(window.history.state, '', url.toString()); } }, []);
  const run = async (task: () => Promise<void>) => { setBusy(true); setError(''); setNotice(''); try { await task(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const action = (path: string, body = {}) => void run(async () => { await call(path, body); await load(); setNotice('Gmail connection updated.'); });
  return <section className="my-4 space-y-4 rounded border bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{admin ? 'Gmail communications' : 'Connect your Gmail'}</h2><p className="mt-1 text-sm text-slate-600">Share recruiting emails with your application team.</p></div>{base && <Button variant="outline" disabled={busy} onClick={() => void run(load)}>Refresh</Button>}</div>
    {admin && <><form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void run(async () => { const parsed = new URL(service); if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error('Enter the HTTPS origin of your Gmail service.'); await act('settings.update', { settings: { ...state!.settings, gmailServiceUrl: parsed.origin } }); setNotice('Gmail service URL saved.'); }); }}><label className="grid flex-1 gap-1 text-sm">Gmail service URL<input className="rounded border px-3 py-2" type="url" value={service} onChange={e => setService(e.target.value)} placeholder="https://your-gmail-worker.workers.dev" required /></label><Button disabled={busy} className="self-end">Save connection settings</Button></form><label className="grid max-w-md gap-1 text-sm">Candidate<select className="rounded border px-3 py-2" value={selectedId} onChange={e => setSelectedId(e.target.value)}>{state?.candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{connections.length > 0 && <div className="flex flex-wrap gap-3 text-sm"><span>{connections.filter(c => c.status === 'connected').length} connected</span><span>{connections.filter(c => c.status === 'paused').length} paused</span><span>{connections.filter(c => c.lastError).length} need attention</span></div>}</>}
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="rounded bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    {!base ? <p className="text-sm text-slate-600">Gmail connection is awaiting administrator setup.</p> : <>
      {admin && <div className="flex flex-wrap gap-2"><Button disabled={busy || !selectedId} variant="outline" onClick={() => void run(async () => { const candidate = state!.candidates.find(c => c.id === selectedId)!; await provisionGmail(user!, base, candidate.id, candidate.email, true); setNotice('Gmail enabled. The candidate can connect from their portal.'); })}>Enable Gmail for candidate</Button><Button disabled={busy || !selectedId} variant="outline" onClick={() => void run(async () => { const candidate = state!.candidates.find(c => c.id === selectedId)!; await provisionGmail(user!, base, candidate.id, candidate.email, false); await load(); setNotice('Gmail synchronization disabled.'); })}>Disable Gmail</Button></div>}
      {connection ? <div className="flex flex-wrap items-center gap-3 rounded border bg-slate-50 p-3 text-sm"><strong>{connection.email}</strong><span>{connection.status}</span><span>Last sync: {connection.lastSync ? new Date(connection.lastSync).toLocaleString() : 'Waiting for first sync'}</span>{connection.lastError && <span className="text-red-700">{connection.lastError}</span>}<div className="ml-auto flex flex-wrap gap-2">{connection.status === 'connected' && <><Button variant="outline" disabled={busy} onClick={() => action('/sync')}>Sync now</Button><Button variant="outline" disabled={busy} onClick={() => action('/pause')}>Pause sharing</Button></>}{!admin && connection.status === 'paused' && <Button disabled={busy} onClick={() => action('/resume')}>Resume from now</Button>}{!admin && <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm('Disconnect Gmail and delete all synchronized email copies from ResumeOS?')) action('/disconnect'); }}>Disconnect & delete</Button>}</div></div> : admin ? <p className="text-sm">This candidate has not connected Gmail. They must authorize access from their own portal.</p> : null}
      {!admin && <div className="space-y-3"><label className="grid gap-1 text-sm font-medium">Recruiter email addresses or domains to share<input className="rounded border px-3 py-2" value={senders} onChange={e => setSenders(e.target.value)} placeholder="recruiter@company.com, greenhouse.io" /></label><p className="text-sm text-slate-600">Only job-related messages from these exact senders or domains are retained. Gmail grants mailbox read access; ResumeOS applies your sharing filter. Sync starts from connection time. Shared copies expire after 90 days. OTP and password-reset messages are excluded.</p>{(!connection || connection.status === 'reconnect') ? <><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" />I agree to automatic processing and admin access to job messages from my selected senders.</label><Button disabled={busy || !consent || !senders.trim()} onClick={() => void run(async () => { const result = await call('/connect', { senders, consent }); window.location.assign(result.url); })}>{connection ? 'Reconnect Gmail' : 'Connect Gmail'}</Button></> : <Button variant="outline" disabled={busy || !senders.trim()} onClick={() => action('/sharing', { senders } as never)}>Save sharing preferences</Button>}</div>}
      <div className="space-y-2">{messages.map(m => <details key={m.id} className="rounded border p-3"><summary className="cursor-pointer text-sm"><strong>{m.subject || '(No subject)'}</strong><span className="ml-3 text-slate-600">{m.category} · {new Date(m.received_at).toLocaleDateString()}</span></summary><p className="mt-2 text-sm text-slate-600">{m.sender}</p><p className="mt-3 whitespace-pre-wrap text-sm">{m.preview || 'No plain-text preview available.'}</p></details>)}{connection && !messages.length && <p className="py-3 text-sm text-slate-600">No shared job messages yet. New messages matching your sharing preferences appear after synchronization.</p>}</div>
    </>}
  </section>;
}
