'use client';
import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronRight, Search, Users, FileText } from 'lucide-react';
import { Button } from './ui/button';
import type { CatalogJob, JobMatch } from '@/lib/matching';
import type { AppState } from '@/lib/types';

export function JobsWorkspace({ jobs, matches, state, review, edit, openStudio, updateStatus }: {
  jobs: CatalogJob[]; matches: JobMatch[]; state: AppState;
  review: (match: JobMatch) => void; edit: (job: CatalogJob) => void;
  openStudio: (step: number, id?: string) => void;
  updateStatus: (id: string, status: string) => void;
}) {
  const [selectedId, select] = useState<string | null>(null);
  const [search, setSearch] = useState(''); const [family, setFamily] = useState('All');
  const [status, setStatus] = useState('All'); const [candidateSearch, setCandidateSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const selected = jobs.find(j => j.id === selectedId);
  const jobStatus = (job: CatalogJob) => job.analysisStatus === 'Pending' ? 'Pending analysis' : job.status === 'Closed' ? 'Closed' : Date.parse(job.expiresAt) <= Date.now() ? 'Expired' : 'Open';
  const related = (jobId: string) => matches.filter(m => m.jobId === jobId && !m.reasons.some(r => r.includes('Job family is not approved')));
  const badge = (text: string) => <span className="inline-flex rounded border bg-slate-50 px-2 py-1 text-xs font-medium">{text}</span>;
  const fields = (items: Array<[string, string]>) => <dl className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-3">{items.map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-medium break-words">{value || 'Not specified'}</dd></div>)}</dl>;
  if (selected) {
    const candidateMatches = matches.filter(m => m.jobId === selected.id && (showAll || !m.reasons.some(r => r.includes('Job family is not approved'))))
      .filter(m => (state.candidates.find(c => c.id === m.candidateId)?.name ?? '').toLowerCase().includes(candidateSearch.toLowerCase()))
      .sort((a, b) => b.score - a.score);
    return <div className="space-y-4">
      <Button variant="outline" onClick={() => select(null)}><ArrowLeft /> All jobs</Button>
      <div className="flex flex-wrap items-start justify-between gap-3 rounded border bg-white p-5"><div><div className="mb-2 flex gap-2">{badge(selected.family)}{badge(jobStatus(selected))}</div><h2 className="text-2xl font-semibold">{selected.title}</h2><p className="mt-1 text-slate-600">{selected.company} · {selected.location} · {selected.workType}</p></div><div className="flex gap-2"><a className="inline-flex items-center gap-1 rounded border px-3 py-2 text-sm" href={/^https?:\/\//i.test(selected.sourceUrl) ? selected.sourceUrl : undefined} target="_blank" rel="noreferrer">Original posting <ArrowUpRight size={16} /></a><Button variant="outline" onClick={() => edit(selected)}>{selected.analysisStatus === 'Pending' ? 'Analyze & assign family' : 'Edit / analyze JD'}</Button></div></div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <section className="min-w-0 rounded border bg-white p-5">
          {fields([['Normalized role', selected.role], ['Salary', selected.salary || 'Not specified'], ['Experience', selected.minimumYears == null ? '' : `${selected.minimumYears}+ years`], ['Seniority', selected.seniority], ['Authorization', selected.authorization], ['Source', selected.source]])}
          <h3 className="mt-6 flex items-center gap-2 border-t pt-4 font-semibold"><FileText size={18} /> Full job description</h3><div className="mt-3 whitespace-pre-wrap break-words text-base leading-7">{selected.jdText || 'No job description has been saved.'}</div>
          <h3 className="mt-6 border-t pt-4 font-semibold">Requirements</h3>{[['Mandatory', selected.mandatorySkills], ['Critical', selected.criticalSkills], ['Preferred', selected.preferredSkills]].map(([label, skills]) => <div key={String(label)} className="mt-3"><p className="mb-2 text-sm text-slate-500">{label}</p><div className="flex flex-wrap gap-2">{(skills as string[]).length ? (skills as string[]).map(s => <span key={s}>{badge(s)}</span>) : <span className="text-sm text-slate-500">None recorded</span>}</div></div>)}
        </section>
        <section className="min-w-0 rounded border bg-white"><div className="border-b p-4"><h3 className="flex items-center gap-2 font-semibold"><Users size={18} /> Candidates for this job ({candidateMatches.length})</h3><p className="mt-1 text-sm text-slate-500">Family match → assign candidate → generate resume.</p><input aria-label="Search candidates for job" placeholder="Search candidates" className="mt-3 w-full rounded border px-3 py-2 text-sm" value={candidateSearch} onChange={e => setCandidateSearch(e.target.value)} /><label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> Include other families</label></div>
          {candidateMatches.map(m => {
            const candidate = state.candidates.find(c => c.id === m.candidateId);
            const application = state.jobs.find(j => j.catalogId === selected.id && j.candidateId === m.candidateId);
            return <article key={m.id} className="border-b p-4 last:border-0">
              <h4 className="font-semibold">{candidate?.name || 'Unavailable candidate'}</h4>
              <p className="mt-1 text-sm text-slate-500">{candidate?.family}</p>
              <p className="my-3 text-sm">{m.reasons.join(' ')}</p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={m.eligibility !== 'Eligible'} onClick={() => review(m)}>{m.applicationId ? 'Open resumes' : 'Assign & open studio'}</Button>
                {application && m.applicationId && <select aria-label={`Application status for ${candidate?.name}`} value={application.status} className="rounded border px-2 py-1 text-sm" onChange={e => updateStatus(application.id, e.target.value)}>{['Selected', 'Pending', 'Applied', 'Interview', 'Rejected', 'Offer', 'Failed'].map(s => <option key={s}>{s}</option>)}</select>}
              </div>
            </article>;
          })}
          {!candidateMatches.length && <p className="p-5 text-sm text-slate-500">No candidates in these families. Review candidate family preferences or include other families.</p>}
        </section>
      </div>
    </div>;
  }
  const filtered = jobs.filter(j => `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(search.toLowerCase()) && (family === 'All' || j.family === family) && (status === 'All' || jobStatus(j) === status));
  return <div className="rounded border bg-white"><div className="flex flex-wrap items-center gap-3 border-b p-4"><label className="flex min-w-56 flex-1 items-center gap-2"><Search size={18} /><input aria-label="Search jobs" placeholder="Search job, company or location" className="w-full rounded border px-3 py-2 text-sm" value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label="Filter job family" className="rounded border px-3 py-2 text-sm" value={family} onChange={e => setFamily(e.target.value)}><option value="All">All families</option>{[...new Set(jobs.map(j => j.family))].sort().map(f => <option key={f}>{f}</option>)}</select><select aria-label="Filter job status" className="rounded border px-3 py-2 text-sm" value={status} onChange={e => setStatus(e.target.value)}>{['All', 'Pending analysis', 'Open', 'Closed', 'Expired'].map(s => <option key={s}>{s}</option>)}</select><span className="text-sm text-slate-500">{filtered.length} jobs</span></div><div className="overflow-x-auto"><table className="w-full min-w-[750px] text-left text-sm"><thead className="border-b bg-slate-50"><tr>{['Job / company', 'Family', 'Location / salary', 'Candidates', 'Status', ''].map((h, i) => <th className="p-4 font-medium text-slate-600" key={i}>{h}</th>)}</tr></thead><tbody>{filtered.map(j => <tr key={j.id} onClick={() => select(j.id)} className="cursor-pointer border-b last:border-0 hover:bg-slate-50"><td className="p-4"><button className="text-left font-semibold underline-offset-4 hover:underline" onClick={() => select(j.id)}>{j.title}</button><p className="mt-1 text-slate-500">{j.company}</p></td><td className="p-4">{j.family}</td><td className="p-4">{j.location}<p className="mt-1 text-slate-500">{j.salary}</p></td><td className="p-4">{related(j.id).length} candidates<p className="mt-1 text-slate-500">{related(j.id).filter(m => m.reviewedDecision === 'Approved').length} assigned</p></td><td className="p-4">{badge(jobStatus(j))}</td><td className="p-4"><ChevronRight size={18} /></td></tr>)}</tbody></table></div>{!filtered.length && <p className="p-6 text-slate-500">No jobs found. Adjust filters or add a shared JD.</p>}</div>;
}
