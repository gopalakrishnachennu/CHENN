'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePlatform } from '@/lib/platform-context';
import { DEFAULT_WORKFLOW_PROMPTS, PROMPT_NAMES, OUTPUT_CONTRACT, type PromptStage, type WorkflowPrompt } from '@/lib/workflow-prompts';
import { promptHistory } from '@/lib/workflow-prompt-store';
import { readLLMUsage } from '@/lib/llm-usage-store';
import { usageSummary, type LLMUsageRecord } from '@/lib/llm-usage';

export function WorkflowStudio() {
  const { state, act } = usePlatform();
  const [stage, setStage] = useState<PromptStage>('jd-normalization');
  const [text, setText] = useState('');
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<WorkflowPrompt[]>([]);
  const saved = state?.prompts.find(p => p.id === stage);
  useEffect(() => { setText(saved?.template || DEFAULT_WORKFLOW_PROMPTS[stage]); setVersion(saved?.version ?? 0); setHistory([]); setMessage(''); }, [stage, saved?.version, saved?.template]);
  const dirty = text !== (saved?.template || DEFAULT_WORKFLOW_PROMPTS[stage]);
  const publish = async () => {
    setBusy(true); setMessage('');
    try { const result = await act('prompt.save', { stage, template: text, expectedVersion: version }); setMessage(result.message || 'Prompt published.'); setHistory([]); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not publish.'); }
    finally { setBusy(false); }
  };
  return <section className="mb-6 rounded-2xl border bg-white p-5 sm:p-6">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">AI workflow prompts</h2><p className="mt-1 text-sm text-slate-600">These published instructions run your JD analysis and resume generation.</p></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700">Word export · Aptos · 9 pt · Justified</span></div>
    <div className="mb-5 flex gap-2" role="tablist" aria-label="Prompt stage">{(Object.keys(PROMPT_NAMES) as PromptStage[]).map(s => <Button key={s} role="tab" aria-selected={s === stage} variant={s === stage ? 'default' : 'outline'} disabled={busy} onClick={() => { if (!dirty || window.confirm('Discard your unpublished edits?')) setStage(s); }}>{PROMPT_NAMES[s]}</Button>)}</div>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><label htmlFor="workflow-prompt" className="font-semibold">{PROMPT_NAMES[stage]} instructions</label><span className="text-sm text-slate-600">Published v{version || 1}{dirty ? ' · Unpublished changes' : ''}</span></div>
    <p className="mb-3 text-sm text-slate-600">{stage === 'jd-normalization' ? 'Input: job posting and family context. Output: reusable structured JD profile. A new prompt version will be used the next time analysis is requested.' : 'Input: cached JD profile, candidate facts, skills and employment records. Output: structured resume content. Layout is controlled by the export template.'}</p>
    <textarea id="workflow-prompt" value={text} onChange={e => setText(e.target.value)} disabled={busy} maxLength={24000} spellCheck={false} className="min-h-[360px] w-full resize-y rounded-lg border p-4 font-mono text-sm leading-6" />
    <div className="mt-3 flex flex-wrap items-center gap-3"><Button onClick={() => void publish()} disabled={busy || text.trim().length < 80 || !dirty && !!saved}>{busy ? 'Publishing…' : 'Publish prompt'}</Button><Button variant="outline" disabled={busy} onClick={() => setText(DEFAULT_WORKFLOW_PROMPTS[stage])}>Load recommended draft</Button><Button variant="outline" onClick={async () => { try { setHistory(await promptHistory(stage)); } catch { setMessage('Could not load version history. Try again.'); } }}>Version history</Button><span className="ml-auto text-sm text-slate-500">{text.length.toLocaleString()} / 24,000 characters</span></div>
    {message && <p role="status" className="mt-3 rounded-lg bg-slate-100 p-3 text-sm">{message}</p>}
    {history.length > 0 && <div className="mt-4 space-y-2">{history.map(p => <div key={p.version} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm"><span>Version {p.version} · {new Date(p.updatedAt).toLocaleString()}</span><Button variant="outline" onClick={() => { setText(p.template); setMessage(`Version ${p.version} loaded as a draft. Publish to use it for future requests.`); }}>Load as draft</Button></div>)}</div>}
    <details className="mt-5 border-t pt-4 text-sm"><summary className="cursor-pointer font-semibold">Output contract and validation</summary><p className="mt-2 text-slate-600">{OUTPUT_CONTRACT}</p><p className="mt-2 text-slate-600">This contract is appended to your published prompt. JSON fields, source references, dates, credentials and employer-specific claims are checked in code. Publishing changes future requests; existing resumes keep their original prompt snapshot.</p></details>
  </section>;
}

export function LLMUsageDashboard() {
  const [rows, setRows] = useState<LLMUsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState('all');
  const [stage, setStage] = useState('all');
  const [page, setPage] = useState(0);
  const refresh = async () => { setLoading(true); setError(''); try { setRows(await readLLMUsage()); } catch { setError('Usage could not be loaded. Your previous results are retained. Try Refresh.'); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { setPage(0); }, [days, stage, rows]);
  const filtered = rows.filter(r => (stage === 'all' || r.stage === stage) && (days === 'all' || Date.parse(r.startedAt) >= Date.now() - Number(days) * 86400000));
  const stats = usageSummary(filtered);
  const fmt = (n: number) => n.toLocaleString();
  const groups = [...new Set(filtered.map(r => r.model))].map(model => ({ model, ...usageSummary(filtered.filter(r => r.model === model)) }));
  return <section className="mb-6 rounded-2xl border bg-white p-5 sm:p-6">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">LLM usage</h2><p className="mt-1 text-sm text-slate-600">Recorded application requests and provider-reported tokens.</p></div><Button variant="outline" disabled={loading} onClick={() => void refresh()}>{loading ? 'Loading…' : 'Refresh usage'}</Button></div>
    <div className="mb-4 flex flex-wrap gap-3"><label className="text-sm">Period <select value={days} onChange={e => setDays(e.target.value)} className="ml-2 rounded border p-2"><option value="all">All recorded time</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label><label className="text-sm">Workflow <select value={stage} onChange={e => setStage(e.target.value)} className="ml-2 rounded border p-2"><option value="all">All stages</option><option value="jd-normalization">JD normalization</option><option value="resume-generation">Resume generation</option></select></label></div>
    {error && <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-red-800">{error}</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Total reported tokens', fmt(stats.total)], ['Input tokens', fmt(stats.input)], ['Output tokens', fmt(stats.output)], ['Call attempts', fmt(stats.calls)], ['Completed responses', fmt(stats.completed)], ['Failed calls', fmt(stats.failed)], ['Cache reuses · no API call', fmt(stats.cacheHits)], ['Average response time', stats.averageMs == null ? 'Unavailable' : `${(stats.averageMs / 1000).toFixed(1)} s`]].map(([name, value]) => <div key={name} className="rounded-lg border p-4"><p className="text-sm text-slate-600">{name}</p><p className="mt-2 text-2xl font-semibold">{loading && !rows.length ? '—' : value}</p></div>)}</div>
    <p className="mt-4 text-sm text-slate-600">Cached input: {fmt(stats.cachedInput)} · Reasoning output: {fmt(stats.reasoning)} (subsets, already included above). {fmt(stats.unknown)} calls have unknown token usage; {fmt(stats.pending)} dispatch records have no final result. Completed responses can still require content validation.</p>
    <p className="mt-2 text-sm text-slate-600">Historical totals include recoverable successful responses only. Earlier failures and cache reuses were not recorded. Calls outside this portal are excluded. Unknown usage is not zero usage. This dashboard does not estimate billing charges.</p>
    {groups.length > 0 && <div className="mt-5 flex flex-wrap gap-3">{groups.map(g => <div key={g.model} className="rounded bg-slate-50 p-3 text-sm"><b>{g.model}</b> · {fmt(g.calls)} calls · {fmt(g.total)} tokens</div>)}</div>}
    <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500">{['Time', 'Stage / prompt', 'Model', 'Outcome', 'Input / output', 'Latency'].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{filtered.slice(page * 25, page * 25 + 25).map(r => <tr key={r.id} className="border-b"><td className="p-3">{r.startedAt ? new Date(r.startedAt).toLocaleString() : 'Unknown'}{r.historical && <span className="block text-slate-500">Historical</span>}</td><td className="p-3">{PROMPT_NAMES[r.stage as PromptStage] || r.stage}{r.promptVersion && <span className="block text-slate-500">v{r.promptVersion}</span>}</td><td className="p-3">{r.model}</td><td className="p-3">{r.outcome || r.status}{r.httpStatus && <span className="block text-slate-500">HTTP {r.httpStatus}</span>}{!!r.validationErrors?.length && <details><summary className="cursor-pointer">Validation details</summary><ul>{r.validationErrors.map((e, i) => <li key={i}>{e}</li>)}</ul></details>}</td><td className="p-3">{r.usage && r.usage.reported !== false ? `${fmt(r.usage.inputTokens)} / ${fmt(r.usage.outputTokens)}` : r.status === 'cache-hit' ? 'No API call' : 'Unknown'}</td><td className="p-3">{r.durationMs == null ? '—' : `${(r.durationMs / 1000).toFixed(1)} s`}</td></tr>)}</tbody></table>{!loading && !filtered.length && <p className="p-4 text-sm text-slate-600">No recorded activity for this selection.</p>}</div>
    {filtered.length > 25 && <div className="mt-3 flex items-center gap-3"><Button variant="outline" disabled={!page} onClick={() => setPage(p => p - 1)}>Previous</Button><span className="text-sm">Page {page + 1} of {Math.ceil(filtered.length / 25)}</span><Button variant="outline" disabled={(page + 1) * 25 >= filtered.length} onClick={() => setPage(p => p + 1)}>Next</Button></div>}
  </section>;
}
