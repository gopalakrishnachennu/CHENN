'use client';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { JobsWorkspace } from '@/components/jobs-workspace';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usePlatform } from '@/lib/platform-context';
import { importCatalog, readMatchingData, runMatching, savePreferences, decideMatch, saveCatalogJob, cachedJDProfile } from '@/lib/matching-store';
import { parseJobImport, preferences, type CatalogJob, type JobMatch } from '@/lib/matching';
import { analyzeJD, classifyJobFamily, extractStructuredRequirements } from '@/lib/jd-intelligence';
import type { JobFamily } from '@/lib/types';

const fieldClass = 'w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm';
function Field({ name, label, value = '', type = 'text', required = false }: { name: string; label: string; value?: string | number; type?: string; required?: boolean }) {
  return <label className="grid gap-1 text-sm font-medium">{label}{required ? ' *' : ''}<input className={fieldClass} name={name} defaultValue={value} type={type} required={required} step={type === 'number' ? 'any' : undefined} /></label>;
}
function Cell({ children }: { children: ReactNode }) { return <td className="border-b px-3 py-3 align-top">{children}</td>; }
type JobSuggestion = { family: string; role: string; confidence: number; seniority: string; minimumYears: number | null; mandatorySkills: string[]; criticalSkills: string[]; preferredSkills: string[]; authorization: string; workType: string; responsibilities: string[]; attention: string[] };
function suggestionFor(input: { title: string; company?: string; family?: string; jdText: string; workType?: string; intelligence?: CatalogJob['intelligence']; requirements?: CatalogJob['requirements'] }, families: JobFamily[]): JobSuggestion {
  const family = classifyJobFamily(input, families);
  const analysis = input.intelligence ?? analyzeJD({ title: input.title, company: input.company, family: family.family || input.family, jdText: input.jdText });
  const structured = input.requirements ?? extractStructuredRequirements(input.jdText);
  const technical = analysis.requirements.filter(item => ['skill', 'platform', 'tool', 'methodology'].includes(item.kind));
  const mandatorySkills = [...new Set(technical.filter(item => item.classification === 'Mandatory' || item.classification === 'Required').map(item => item.canonical))];
  const criticalSkills = [...new Set(technical.filter(item => item.importance === 'Critical').map(item => item.canonical))];
  const preferredSkills = [...new Set(technical.filter(item => item.classification === 'Preferred').map(item => item.canonical))];
  const jd = input.jdText.toLowerCase();
  const workType = /\bremote\b/.test(jd) ? 'Remote' : /\bhybrid\b/.test(jd) ? 'Hybrid' : /\b(on[- ]?site|in office)\b/.test(jd) ? 'On-site' : input.workType || 'Not specified';
  const attention = [!family.family && 'Confirm job family', family.confidence < 80 && 'Review low-confidence family', !mandatorySkills.length && 'Confirm mandatory skills', !structured.authorization && 'Work authorization not found in JD; leave Not specified unless the posting says otherwise'].filter(Boolean) as string[];
  return { family: family.family || 'Custom / needs review', role: analysis.normalizedTitle, confidence: family.confidence, seniority: analysis.seniority, minimumYears: structured.minimumYears, mandatorySkills, criticalSkills, preferredSkills, authorization: structured.authorization, workType, responsibilities: analysis.dayToDayResponsibilities, attention };
}
export function JobMatching({ notify, openStudio, applicationView }: { notify: (message: string, tone?: 'success' | 'error') => void; openStudio: (step: number, id?: string) => void; applicationView?: ReactNode }) {
  const { state, user, refresh, act } = usePlatform();
  const [data, setData] = useState<{ jobs: CatalogJob[]; matches: JobMatch[] }>({ jobs: [], matches: [] });
  const [tab, setTab] = useState('Catalog'); const [pending, setPending] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  const [modal, setModal] = useState<'job' | 'import' | 'review' | null>(null); const [editJob, setEditJob] = useState<CatalogJob | null>(null);
  const [selected, setSelected] = useState<JobMatch | null>(null); const [candidateId, setCandidateId] = useState(state?.candidates[0]?.id ?? '');
  const [decisionFilter, setDecisionFilter] = useState('All'); const [search, setSearch] = useState(''); const [importText, setImportText] = useState('');
  const [suggestion, setSuggestion] = useState<JobSuggestion | null>(null); const [suggestionApplied, setSuggestionApplied] = useState(false); const jobForm = useRef<HTMLFormElement>(null);
  const load = async () => { if (user) { setData(await readMatchingData(user)); setLoaded(true); } };
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setLoaded(false); setError('');
    if (user) void readMatchingData(user)
      .then(x => { if (!cancelled) { setData(x); setLoaded(true); } })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, retry]);
  const perform = async (task: () => Promise<unknown>, message: string) => {
    setPending(true); setError(''); try { await task(); await load(); await refresh(); notify(message); } catch (e) { setError((e as Error).message); notify((e as Error).message, 'error'); } finally { setPending(false); }
  };
  if (!state || !user) return null;
  const candidate = state.candidates.find(c => c.id === candidateId); const p = preferences(candidate?.matchPreferences);
  const assignCandidate = async (match: JobMatch) => {
    if (match.applicationId) { openStudio(3, match.applicationId); return; }
    await perform(async () => {
      const applicationId = await decideMatch(user, match.id, 'Approved', 'Assigned by job family taxonomy.');
      if (applicationId) openStudio(3, applicationId);
    }, 'Candidate assigned by family. Resume studio is ready.');
  };
  const submitJob = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    const finalize = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'analyzed';
    if (finalize && !suggestionApplied) { setError('Accept the analysis suggestions first.'); return; }
    await perform(async () => {
      if (editJob) await saveCatalogJob(user, { ...editJob, ...values } as unknown as CatalogJob, !finalize);
      else { const result = await importCatalog(user, [values], true); if (!result.added) throw new Error('This job already exists in the catalog.'); }
      setModal(null);
    }, finalize ? 'Analysis saved. Use Recalculate matches when ready.' : 'Job saved. Open it to analyze and assign a family later.');
  };
  const prepareSuggestion = async (job?: CatalogJob | null) => {
    const form = jobForm.current; const values = form ? Object.fromEntries(new FormData(form)) : job;
    const title = String(values?.title ?? '').trim(); const jdText = String(values?.jdText ?? '').trim();
    if (!title || !jdText) { setError('Add the job title and complete JD before requesting suggestions.'); return; }
    setError(''); setSuggestionApplied(false); setPending(true);
    try {
      const company = String(values?.company ?? '');
      const family = classifyJobFamily({ title, jdText }, state.families).family || 'Custom / needs review';
      const cached = await cachedJDProfile(user, { title, jdText, company, family }, state.credential.connected ? state.settings.system.openAIModel : undefined);
      const latest = jobForm.current ? Object.fromEntries(new FormData(jobForm.current)) : values;
      if (String(latest?.title ?? '').trim() !== title || String(latest?.jdText ?? '').trim() !== jdText || String(latest?.company ?? '') !== company) return;
      setSuggestion(suggestionFor({ title, jdText, company, family, workType: String(values?.workType ?? ''), intelligence: cached.intelligence, requirements: cached.requirements }, state.families));
    } catch (error) { setError((error as Error).message); }
    finally { setPending(false); }
  };
  const applySuggestion = () => {
    if (!suggestion || !jobForm.current) return;
    const set = (name: string, value: string | number | null) => { const element = jobForm.current?.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null; if (element) element.value = value == null ? '' : String(value); };
    set('family', suggestion.family); set('role', suggestion.role); set('familyConfidence', suggestion.confidence); set('seniority', suggestion.seniority); set('minimumYears', suggestion.minimumYears); set('mandatorySkills', suggestion.mandatorySkills.join(', ')); set('criticalSkills', suggestion.criticalSkills.join(', ')); set('preferredSkills', suggestion.preferredSkills.join(', ')); set('authorization', suggestion.authorization); set('workType', suggestion.workType);
    setSuggestionApplied(true); notify('JD suggestions applied. Review highlighted exceptions, then approve and match.');
  };
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Jobs</h1><p className="mt-1 text-sm text-slate-600">Open a job to read its JD and review all matching candidates.</p></div><div className="flex gap-2"><Button variant="outline" disabled={pending} onClick={() => void perform(() => runMatching(user), 'Matches refreshed.')}>Recalculate matches</Button><Button onClick={() => { setEditJob(null); setSuggestion(null); setSuggestionApplied(false); setModal('job'); }}>Add job</Button></div></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Shared jobs', data.jobs.length], ['Selected', data.matches.filter(m => m.decision === 'Selected').length], ['Pending analysis', data.jobs.filter(j => j.analysisStatus === 'Pending').length], ['Applications', data.matches.filter(m => m.applicationId).length]].map(([label, value]) => <div key={label} className="rounded border bg-white p-4"><p className="text-sm text-slate-600">{label}</p><p className="mt-1 text-2xl font-semibold">{loaded ? value : '—'}</p></div>)}</div>
    <div className="flex gap-1 border-b" role="tablist" aria-label="Job matching views">{['Catalog', 'Matches', ...(applicationView ? ['Applications'] : [])].map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium ${tab === t ? 'border-b-2 border-blue-700 text-blue-800' : 'text-slate-600'}`}>{t}</button>)}</div>
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {pending && <p role="status">Processing your request. You can still browse saved jobs below.</p>}
    {loading ? <p role="status">Loading saved jobs…</p> : !loaded ? <Button variant="outline" onClick={() => setRetry(x => x + 1)}>Retry loading jobs</Button> : tab === 'Catalog' ? <>
      <div className="flex justify-end"><Button variant="outline" onClick={() => setModal('import')}>Import CSV / JSON</Button></div>
      <JobsWorkspace jobs={data.jobs} matches={data.matches} state={state} review={m => { void assignCandidate(m); }} edit={j => { setEditJob(j); setSuggestion(null); setSuggestionApplied(false); setModal('job'); }} openStudio={openStudio} updateStatus={(id, status) => { void perform(() => act('job.status', { id, status }), 'Application status updated.'); }} />
    </> : tab === 'Matches' ? <>
      <p className="text-sm text-slate-600">Candidates match through their primary or approved secondary taxonomy family.</p>
      <div className="overflow-x-auto rounded border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Candidate', 'Job', 'Family', 'Action'].map(x => <th className="px-3 py-3" key={x}>{x}</th>)}</tr></thead><tbody>{data.matches.filter(m => m.eligibility === 'Eligible').map(m => { const j = data.jobs.find(x => x.id === m.jobId); return <tr key={m.id}><Cell>{state.candidates.find(c => c.id === m.candidateId)?.name ?? 'Archived candidate'}</Cell><Cell>{j?.title}<div className="text-slate-500">{j?.company}</div></Cell><Cell>{j?.family}</Cell><Cell><Button disabled={pending} onClick={() => void assignCandidate(m)}>{m.applicationId ? 'Open resumes' : 'Assign & open studio'}</Button></Cell></tr>; })}</tbody></table>{!data.matches.some(m => m.eligibility === 'Eligible') && <p className="p-6 text-sm">No family matches. Assign job and candidate families, then recalculate matches.</p>}</div>
    </> : applicationView}
    <Dialog open={modal !== null} onOpenChange={open => { if (!open && !pending) { setModal(null); setSuggestion(null); setSuggestionApplied(false); } }}><DialogContent className="max-h-[90vh] overflow-y-auto rounded-md sm:max-w-5xl"><DialogHeader><DialogTitle>{modal === 'job' ? editJob ? 'Edit shared job' : 'Add shared job' : modal === 'import' ? 'Import job catalog' : 'Job details'}</DialogTitle><DialogDescription>{modal === 'job' ? 'One JD can match multiple candidates. Required fields must reflect the actual job posting.' : modal === 'import' ? 'Upload up to 100 jobs. Invalid rows are reported before import starts.' : 'Manage shared jobs.'}</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {modal === 'job' ? <form ref={jobForm} onChange={e => { if (['title', 'jdText', 'company'].includes((e.target as unknown as HTMLInputElement).name)) { setSuggestion(null); setSuggestionApplied(false); } }} onSubmit={submitJob} className="space-y-4"><div className="rounded border bg-slate-50 p-3"><p className="text-sm">{editJob ? "Saved job. Analyze its description and assign a family when ready." : "Save the six posting details first. Analysis and family assignment come next."}</p>{editJob && <Button type="button" variant="outline" disabled={pending} onClick={() => void prepareSuggestion(editJob)}><Sparkles className="size-4" /> Analyze saved JD</Button>}</div><div className="grid gap-3 sm:grid-cols-2">
        <Field name="title" label="Job title" value={editJob?.title} required /><Field name="company" label="Company" value={editJob?.company} required /><Field name="location" label="Job location" value={editJob?.location} required /><Field name="sourceUrl" label="Job URL" type="url" value={editJob?.sourceUrl} required /><Field name="salary" label="Salary (posting wording, currency and period)" value={editJob?.salary ?? (editJob?.salaryMax != null ? `Up to ${editJob.currency} ${editJob.salaryMax}/year` : '')} required />
      </div><label className="grid gap-1 text-sm font-medium">Complete job description *<textarea required name="jdText" defaultValue={editJob?.jdText} rows={10} className={fieldClass} placeholder="Paste the complete job description here" /></label>
      {editJob && <details className="rounded border bg-slate-50" open={!!suggestion}><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Family and analyzed details</summary><div className="grid gap-3 border-t p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field name="workType" label="Work type" value={editJob?.workType ?? 'Not specified'} />
        <label className="grid gap-1 text-sm font-medium">Job family<select name="family" defaultValue={editJob?.family ?? 'Custom / needs review'} className={fieldClass}>{state.families.filter(f => f.active).map(f => <option key={f.id}>{f.name}</option>)}<option>Custom / needs review</option></select></label>
        <Field name="role" label="Normalized role" value={editJob?.role} /><Field name="seniority" label="Seniority" value={editJob?.seniority} /><Field name="authorization" label="Work authorization" value={editJob?.authorization} /><Field name="minimumYears" label="Minimum years" type="number" value={editJob?.minimumYears ?? ''} />
        <Field name="mandatorySkills" label="Mandatory skills" value={editJob?.mandatorySkills.join(', ')} /><Field name="criticalSkills" label="Critical skills" value={editJob?.criticalSkills.join(', ')} /><Field name="preferredSkills" label="Preferred skills" value={editJob?.preferredSkills.join(', ')} />
        <Field name="salaryMax" label="Maximum annual salary" type="number" value={editJob?.salaryMax ?? ''} /><Field name="currency" label="Currency" value={editJob?.currency ?? 'USD'} /><Field name="source" label="Job source" value={editJob?.source ?? 'Manual'} /><Field name="expiresAt" label="Expires on" type="date" value={editJob?.expiresAt.slice(0, 10)} /><Field name="familyConfidence" label="Family confidence" type="number" value={editJob?.familyConfidence ?? 0} />
        <label className="grid gap-1 text-sm font-medium">Job status<select name="status" defaultValue={editJob?.status ?? 'Open'} className={fieldClass}><option>Open</option><option>Closed</option></select></label>
      </div></details>}{suggestion && <section className="rounded border border-indigo-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-indigo-700" /> JD suggestions ready</p><p className="mt-1 text-sm text-slate-600">{suggestion.family} · {suggestion.role} · {suggestion.confidence}% family confidence</p></div><Button type="button" onClick={applySuggestion}>{suggestionApplied ? 'Suggestions accepted' : 'Accept all suggestions'}</Button></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><span className="text-slate-500">Seniority</span><p className="font-semibold">{suggestion.seniority}</p></div><div><span className="text-slate-500">Experience</span><p className="font-semibold">{suggestion.minimumYears == null ? 'Confirm' : `${suggestion.minimumYears}+ years`}</p></div><div><span className="text-slate-500">Mandatory skills</span><p className="font-semibold">{suggestion.mandatorySkills.length}</p></div><div><span className="text-slate-500">Responsibilities</span><p className="font-semibold">{suggestion.responsibilities.length}</p></div></div>{suggestion.attention.length ? <div className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900"><strong>Details to review:</strong> {suggestion.attention.join(' · ')}</div> : <div className="mt-3 rounded bg-emerald-50 p-3 text-sm font-medium text-emerald-800">High-confidence review. Ready to approve and match.</div>}</section>}<div className="flex gap-2"><Button type="submit" name="saveMode" value="draft" disabled={pending}>{editJob ? "Save for later" : "Save job"}</Button>{editJob && suggestion && <Button type="submit" name="saveMode" value="analyzed" disabled={pending || !suggestionApplied}>Save analysis & family</Button>}</div></form> : modal === 'import' ? <div className="space-y-4"><p className="text-sm">Required column names: company, title, location, sourceUrl, salary and jdText. Use the posted salary wording or Not disclosed; do not invent a figure. Jobs are saved immediately for later analysis and family assignment. Optional correction columns: workType, family, role, sourceUrl, mandatorySkills, criticalSkills, preferredSkills, seniority, authorization, minimumYears, salaryMax, currency, expiresAt, familyConfidence. Quote comma-separated skills and multiline JDs in CSV.</p><input type="file" accept=".csv,.json,text/csv,application/json" aria-label="Upload jobs file" onChange={async e => { const file = e.target.files?.[0]; if (file) { if (file.size > 2e6) { setError('Maximum file size is 2 MB.'); return; } setImportText(await file.text()); } }} /><textarea className={fieldClass} rows={10} aria-label="Job import content" placeholder="Paste a CSV or JSON array" value={importText} onChange={e => setImportText(e.target.value)} /><Button disabled={pending || !importText} onClick={() => void perform(async () => { const rows = parseJobImport(importText); const result = await importCatalog(user, rows, true); notify(`${result.added} jobs imported; ${result.duplicates} duplicates skipped.`); setModal(null); }, 'Jobs saved for later analysis.')}>Validate and import</Button></div> : null}
    </DialogContent></Dialog>
  </section>;
}
