'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, Download, Eye, FileText, GraduationCap, MapPin, PencilLine, Plus, Search, Sparkles, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Candidate, Job, ResumeVersion } from '@/lib/types';

type DetailTab = 'Overview' | 'Career' | 'Jobs' | 'Resumes';

function Status({ value }: { value: string }) {
  return <span className={`candidate-status candidate-status--${value.toLowerCase().replaceAll(' ', '-')}`}>{value}</span>;
}

function date(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
}

export function CandidateWorkspace({ candidates, jobs, resumes, selectedId, onSelect, onBack, onCreate, onEdit, onPreview, onGenerate, onArchive, onDelete }: {
  candidates: Candidate[]; jobs: Job[]; resumes: ResumeVersion[]; selectedId: string | null;
  onSelect: (id: string) => void; onBack: () => void; onCreate: () => void; onEdit: (candidate: Candidate) => void; onPreview: (id: string) => void; onGenerate: (candidateId: string, jobId?: string) => void; onArchive: (candidate: Candidate) => void; onDelete: (candidate: Candidate) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [tab, setTab] = useState<DetailTab>('Overview');
  const candidate = candidates.find(item => item.id === selectedId);
  const candidateJobs = useMemo(() => jobs.filter(item => item.candidateId === selectedId), [jobs, selectedId]);
  const candidateResumes = useMemo(() => resumes.filter(item => item.candidateId === selectedId).sort((a, b) => b.version - a.version), [resumes, selectedId]);
  const filtered = candidates.filter(item => `${item.name} ${item.email} ${item.family} ${item.location}`.toLowerCase().includes(query.toLowerCase()) && (status === 'All' || item.status === status));

  if (!candidate) return (
    <section>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-semibold tracking-[-.025em]">Candidates</h1><p className="mt-1 text-sm text-slate-500">Select a candidate to manage their career, jobs and resumes in one workspace.</p></div>
        <Button onClick={onCreate}><Plus className="size-4" /> Add candidate</Button>
      </div>
      <div className="enterprise-surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex h-10 w-full max-w-md items-center gap-2 border bg-slate-50 px-3 text-sm"><Search className="size-4 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, email, family or location" className="w-full bg-transparent outline-none" /></label>
          <select value={status} onChange={event => setStatus(event.target.value)} className="h-10 border bg-white px-3 text-sm"><option>All</option><option>Active</option><option>Paused</option><option>Archived</option></select>
        </div>
        <div className="candidate-desktop-table overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase tracking-[.06em] text-slate-500"><th className="px-5 py-3">Candidate</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Job family</th><th className="px-4 py-3">Jobs</th><th className="px-4 py-3">Resumes</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Open</th></tr></thead>
            <tbody>{filtered.map(item => { const jobCount = jobs.filter(job => job.candidateId === item.id).length; const resumeCount = resumes.filter(resume => resume.candidateId === item.id).length; return <tr key={item.id} onClick={() => { setTab('Overview'); onSelect(item.id); }} className="cursor-pointer border-b last:border-0 hover:bg-slate-50"><td className="px-5 py-3"><div className="flex items-center gap-3"><span className="avatar avatar--violet">{item.initials}</span><div><p className="font-semibold text-slate-800">{item.name}</p><p className="text-xs text-slate-500">{item.email}</p></div></div></td><td className="px-4 py-3 text-slate-600">{item.location || 'Not set'}</td><td className="px-4 py-3">{item.family}</td><td className="px-4 py-3 font-semibold">{jobCount}</td><td className="px-4 py-3 font-semibold">{resumeCount}</td><td className="px-4 py-3"><Status value={item.status} /></td><td className="px-5 py-3 text-right"><Button variant="outline" size="sm">View</Button></td></tr>; })}</tbody>
          </table>
        </div>
        <div className="candidate-mobile-list hidden divide-y">{filtered.map(item => <button key={item.id} onClick={() => { setTab('Overview'); onSelect(item.id); }} className="w-full p-4 text-left"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="avatar avatar--violet">{item.initials}</span><div><p className="font-semibold">{item.name}</p><p className="mt-0.5 text-xs text-slate-500">{item.family}</p></div></div><Status value={item.status} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500"><span>{item.location || 'Location not set'}</span><span>{jobs.filter(job => job.candidateId === item.id).length} jobs · {resumes.filter(resume => resume.candidateId === item.id).length} resumes</span></div></button>)}</div>
        {!filtered.length && <p className="p-8 text-center text-sm text-slate-500">No candidates match this search.</p>}
      </div>
    </section>
  );

  return (
    <section>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"><ArrowLeft className="size-4" /> All candidates</button>
      <header className="enterprise-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3"><span className="avatar avatar--violet size-11 text-sm">{candidate.initials}</span><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold tracking-[-.02em]">{candidate.name}</h1><Status value={candidate.status} /></div><p className="mt-1 text-sm text-slate-500">{candidate.email} · {candidate.location || 'Location not set'} · {candidate.family}</p><p className="mt-1 text-xs text-slate-500">Portal {candidate.portalEnabled ? 'enabled' : 'disabled'}</p></div></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => onEdit(candidate)}><PencilLine className="size-4" /> Edit</Button><Button variant="outline" disabled={!candidate.portalEnabled || candidate.status === 'Archived'} onClick={() => onPreview(candidate.id)}><Eye className="size-4" /> Preview portal</Button><Button onClick={() => onGenerate(candidate.id, candidateJobs[0]?.id)}><Sparkles className="size-4" /> Generate resume</Button></div>
        </div>
        <nav className="mt-5 flex gap-1 overflow-x-auto border-b" aria-label="Candidate workspace">{(['Overview', 'Career', 'Jobs', 'Resumes'] as DetailTab[]).map(item => <button key={item} onClick={() => setTab(item)} className={`border-b-2 px-4 py-2.5 text-sm font-medium ${tab === item ? 'portal-accent-text border-current' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}</button>)}</nav>
      </header>

      <div className="mt-4">
        {tab === 'Overview' && <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-4"><section className="enterprise-surface p-4"><h2 className="section-heading">Candidate overview</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt>Current / target role</dt><dd>{candidate.headline || candidate.career?.experience[0]?.title || 'Not set'}</dd></div><div><dt>Location</dt><dd>{candidate.location || 'Not set'}</dd></div><div><dt>Job family</dt><dd>{candidate.family}</dd></div><div><dt>Career history</dt><dd>{candidate.career?.experience.length ?? 0} roles · {candidate.career?.education.length ?? 0} education records</dd></div></dl></section><section className="enterprise-surface overflow-hidden"><div className="section-bar"><h2 className="section-heading">Recent jobs</h2><button onClick={() => setTab('Jobs')} className="text-sm font-medium portal-accent-text">View all</button></div>{candidateJobs.slice(0, 4).map(job => <button key={job.id} onClick={() => onGenerate(candidate.id, job.id)} className="flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left last:border-0"><div><p className="font-semibold">{job.title}</p><p className="text-xs text-slate-500">{job.company} · {job.location}</p></div><div className="text-right"><Status value={job.status} /><p className="mt-1 text-xs font-semibold">{job.matchScore}% match</p></div></button>)}{!candidateJobs.length && <p className="p-4 text-sm text-slate-500">No jobs assigned yet.</p>}</section></div><aside className="enterprise-surface p-4"><h2 className="section-heading">Latest resumes</h2><div className="mt-3 space-y-3">{candidateResumes.slice(0, 4).map(resume => { const job = jobs.find(item => item.id === resume.jobId); return <button key={resume.id} onClick={() => onGenerate(candidate.id, resume.jobId)} className="w-full border-b pb-3 text-left last:border-0"><div className="flex items-center justify-between"><p className="font-semibold">{job?.title || 'Resume'}</p><Status value={resume.status} /></div><p className="mt-1 text-xs text-slate-500">{job?.company} · v{resume.version} · {date(resume.createdAt)}</p></button>; })}{!candidateResumes.length && <p className="text-sm text-slate-500">No resumes generated.</p>}</div></aside></div>}
        {tab === 'Career' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <CareerSection title="Employment" icon={BriefcaseBusiness}>
              {candidate.career?.experience.map((item, index) => (
                <Record key={index} title={item.title} subtitle={`${item.company} · ${item.location || 'Location not set'}`} meta={`${item.start || '—'} – ${item.current ? 'Present' : item.end || '—'}`} detail={[item.responsibilities, item.achievements].filter(Boolean).join('\n')} />
              ))}
            </CareerSection>
            <CareerSection title="Education" icon={GraduationCap}>
              {candidate.career?.education.map((item, index) => (
                <Record key={index} title={item.degree} subtitle={`${item.institution}${item.field ? ` · ${item.field}` : ''}`} meta={`${item.start || '—'} – ${item.end || '—'}`} />
              ))}
            </CareerSection>
            <CareerSection title="Certifications" icon={FileText}>
              {candidate.career?.certifications.map((item, index) => (
                <Record key={index} title={item.name} subtitle={item.issuer} meta={item.start || 'Date not set'} />
              ))}
            </CareerSection>
            <CareerSection title="Projects" icon={UserRound}>
              {candidate.career?.projects.map((item, index) => (
                <Record key={index} title={item.name} subtitle={item.technologies} detail={item.contribution || item.outcomes} />
              ))}
            </CareerSection>
          </div>
        )}
        {tab === 'Jobs' && <section className="enterprise-surface overflow-hidden"><div className="section-bar"><h2 className="section-heading">Assigned and matched jobs</h2></div>{candidateJobs.map(job => { const used = candidateResumes.find(resume => resume.id === job.appliedResumeId); return <div key={job.id} className="grid gap-3 border-b px-4 py-4 last:border-0 md:grid-cols-[1fr_auto_auto_auto] md:items-center"><div><p className="font-semibold">{job.title}</p><p className="text-xs text-slate-500">{job.company} · {job.location}</p></div><p className="text-sm font-semibold">{job.matchScore}% match</p><Status value={job.status} /><Button size="sm" variant="outline" onClick={() => onGenerate(candidate.id, job.id)}>{used ? `Resume v${used.version}` : 'Create resume'}</Button></div>; })}{!candidateJobs.length && <p className="p-6 text-sm text-slate-500">No candidate jobs yet.</p>}</section>}
        {tab === 'Resumes' && <section className="enterprise-surface overflow-hidden"><div className="section-bar"><h2 className="section-heading">Job-specific resumes</h2></div>{candidateResumes.map(resume => { const job = jobs.find(item => item.id === resume.jobId); return <div key={resume.id} className="grid gap-3 border-b px-4 py-4 last:border-0 md:grid-cols-[1fr_auto_auto_auto] md:items-center"><div><p className="font-semibold">{job?.title || 'Resume'}</p><p className="text-xs text-slate-500">{job?.company} · {date(resume.createdAt)}</p></div><span className="text-sm font-semibold">v{resume.version}</span><span className="text-sm font-semibold">{resume.scores.jdMatch}% match</span><Button size="sm" variant="outline" onClick={() => onGenerate(candidate.id, resume.jobId)}><Eye className="size-4" /> View</Button></div>; })}{!candidateResumes.length && <p className="p-6 text-sm text-slate-500">No candidate resumes yet.</p>}</section>}
      </div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => onArchive(candidate)}>Archive</Button><Button variant="outline" onClick={() => onDelete(candidate)} className="text-red-700">Delete candidate</Button></div>
    </section>
  );
}

function CareerSection({ title, icon: Icon, children }: { title: string; icon: typeof BriefcaseBusiness; children: React.ReactNode }) { return <section className="enterprise-surface overflow-hidden"><div className="section-bar"><div className="flex items-center gap-2"><Icon className="size-4 text-slate-500" /><h2 className="section-heading">{title}</h2></div></div><div className="divide-y">{children || <p className="p-4 text-sm text-slate-500">No records.</p>}</div></section>; }
function Record({ title, subtitle, meta, detail }: { title: string; subtitle?: string; meta?: string; detail?: string }) { return <article className="p-4"><div className="flex flex-col gap-1 sm:flex-row sm:justify-between"><div><h3 className="font-semibold">{title}</h3><p className="text-sm text-slate-500">{subtitle}</p></div><p className="text-xs text-slate-500">{meta}</p></div>{detail && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{detail}</p>}</article>; }
