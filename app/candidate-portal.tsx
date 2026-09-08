'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Check,
  Clock3,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Link2,
  ListFilter,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ResumePaper } from '@/components/resume-paper';
import { GmailPanel } from './gmail-panel';
import { usePlatform } from '@/lib/platform-context';
import { portalThemeStyle } from '@/lib/portal-theme';
import type { Candidate, Job, ResumeVersion, SkillPlanItem } from '@/lib/types';

type CandidatePage = 'Overview' | 'Applications' | 'Resumes';
type CandidatePortalProps = {
  candidateId?: string;
  exitPreview?: () => void;
  notify: (message: string, tone?: 'success' | 'error') => void;
};

function formatDate(value?: string | null, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(
    'en-US',
    withTime
      ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
      : { month: 'short', day: 'numeric', year: 'numeric' },
  ).format(date);
}

function CandidateBrand({ logoUrl }: { logoUrl: string | null }) {
  const { state } = usePlatform();
  return (
    <div className="flex items-center gap-2.5">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="Portal logo"
          className="size-9 object-contain"
        />
      ) : (
        <div
          className="flex size-9 items-center justify-center rounded-xl text-white shadow-[0_8px_22px_rgba(91,93,228,.22)]"
          style={{ backgroundColor: state?.settings.primaryColor }}
        >
          <Sparkles className="size-[17px]" />
        </div>
      )}
      <div>
        <p className="text-[13px] font-semibold tracking-[-0.02em]">
          {state?.settings.portalName}
        </p>
        <p className="text-[8px] font-semibold uppercase tracking-[.14em] text-[#9aa2b1]">
          Candidate access
        </p>
      </div>
    </div>
  );
}

function ReadOnlyPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef0f4] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[.1em] text-[#697386]">
      <ShieldCheck className="size-3" /> Read only
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`candidate-status candidate-status--${status.toLowerCase().replaceAll(' ', '-')}`}
    >
      {status}
    </span>
  );
}

function CandidateMetric({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  icon: typeof FileText;
  tone: string;
}) {
  return (
    <article className="rounded-2xl border border-[#e5e9ef] bg-white p-5">
      <div className="mb-4 flex items-start justify-between">
        <div className={`candidate-metric candidate-metric--${tone}`}>
          <Icon className="size-[17px]" />
        </div>
        <TrendingUp className="size-3.5 text-[#b1b8c5]" />
      </div>
      <p className="text-[11px] font-medium text-[#7d8697]">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="text-[26px] font-bold tracking-[-0.04em]">{value}</p>
        <p className="mb-1 text-right text-[9px] text-[#9aa2b1]">{note}</p>
      </div>
    </article>
  );
}

function companyStyle(company: string) {
  const colors = [
    'bg-[#172235] text-white',
    'bg-[#635bff] text-white',
    'bg-[#267d67] text-white',
    'bg-[#a05b46] text-white',
    'bg-[#2668a8] text-white',
  ];
  const index =
    [...company].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) %
    colors.length;
  return colors[index];
}

function ApplicationRow({
  job,
  resume,
  open,
}: {
  job: Job;
  resume?: ResumeVersion;
  open: () => void;
}) {
  return (
    <article className="group grid gap-4 border-b border-[#edf0f4] px-5 py-5 last:border-0 hover:bg-[#fafbff] sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
      <div className="flex min-w-0 gap-4">
        <div
          className={`flex size-11 flex-none items-center justify-center rounded-[13px] text-sm font-bold ${companyStyle(job.company)}`}
        >
          {job.company[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[13px] font-semibold text-[#2d3648]">
              {job.title}
            </h3>
            <StatusPill status={job.status} />
          </div>
          <p className="mt-1 text-[11px] font-medium text-[#6f798b]">
            {job.company}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[#929aaa]">
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {job.location}
            </span>
            <span>{job.workType}</span>
            <span>{job.appliedAt ? `Applied ${formatDate(job.appliedAt)}` : `Discovered ${formatDate(job.discoveredAt)}`}</span>
            {resume && <span>Resume v{resume.version}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-5 sm:justify-end">
        <div className="text-right">
          <p className="text-[17px] font-bold tracking-[-0.03em] text-[#30394b]">
            {job.matchScore}%
          </p>
          <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-[#9ca4b2]">
            Match
          </p>
        </div>
        <Button
          onClick={open}
          variant="outline"
          className="h-9 rounded-xl px-3 text-[11px] font-semibold"
        >
          View job <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </article>
  );
}

function Overview({
  candidate,
  jobs,
  resumes,
  openJob,
  goApplications,
}: {
  candidate: Candidate;
  jobs: Job[];
  resumes: ResumeVersion[];
  openJob: (id: string) => void;
  goApplications: () => void;
}) {
  const { state } = usePlatform();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const appliedJobs = jobs.filter((job) => job.appliedAt);
  const countSince = (date: Date) =>
    appliedJobs.filter(
      (job) => job.appliedAt && new Date(job.appliedAt) >= date,
    ).length;
  const recent = jobs
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 5);
  const announcement = state?.announcements.find((item) => item.active);
  return (
    <>
      <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: state?.settings.primaryColor }}
          >
            Welcome back
          </p>
          <h1 className="mt-1.5 text-[28px] font-semibold tracking-[-0.04em] text-[#1c2537] sm:text-[34px]">
            Hello, {candidate.firstName}
          </h1>
          <p className="mt-1.5 text-sm text-[#7f899a]">
            {state?.settings.notifications.welcome}
          </p>
        </div>
        <ReadOnlyPill />
      </div>
      {state?.settings.widgets.announcement && announcement && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#dfe8ff] bg-[#f7f8ff] p-4">
          <Bell className="portal-accent-text mt-0.5 size-4 flex-none" />
          <div>
            <p className="text-xs font-semibold">{announcement.title}</p>
            <p className="mt-1 text-[11px] leading-5 text-[#687286]">
              {announcement.message}
            </p>
          </div>
        </div>
      )}
      {state?.settings.widgets.totals && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CandidateMetric
            label="Applied"
            value={jobs.filter((job) => job.status === 'Applied').length}
            note={`${countSince(startOfMonth)} this month`}
            icon={FileCheck2}
            tone="emerald"
          />
          <CandidateMetric
            label="Interviews"
            value={jobs.filter((job) => job.status === 'Interview').length}
            note="Active process"
            icon={Target}
            tone="violet"
          />
          <CandidateMetric
            label="Offers"
            value={jobs.filter((job) => job.status === 'Offer').length}
            note="Latest outcomes"
            icon={Check}
            tone="emerald"
          />
          <CandidateMetric
            label="Pending"
            value={jobs.filter((job) => job.status === 'Pending').length}
            note="Awaiting action"
            icon={Clock3}
            tone="amber"
          />
        </section>
      )}
      {state?.settings.widgets.recentApplications && (
        <section className="mt-6 overflow-hidden rounded-2xl border border-[#e5e9ef] bg-white">
          <div className="flex items-center justify-between border-b border-[#edf0f4] px-5 py-5 sm:px-6">
            <div>
              <h2 className="text-base font-semibold">Recent applications</h2>
              <p className="mt-1 text-[11px] text-[#8c95a5]">
                Your latest jobs and current status
              </p>
            </div>
            <button
              onClick={goApplications}
              className="flex items-center gap-1.5 text-[11px] font-semibold"
              style={{ color: state?.settings.primaryColor }}
            >
              View all <ArrowUpRight className="size-3.5" />
            </button>
          </div>
          {recent.map((job) => (
            <ApplicationRow
              key={job.id}
              job={job}
              resume={resumes.find((resume) => resume.jobId === job.id)}
              open={() => openJob(job.id)}
            />
          ))}
          {!recent.length && (
            <div className="py-16 text-center text-xs text-[#929aaa]">
              No jobs have been added yet.
            </div>
          )}
        </section>
      )}
      <section className="mt-6 overflow-hidden rounded-2xl border border-[#e5e9ef] bg-white">
        <div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="text-base font-semibold">Latest approved resumes</h2><p className="mt-1 text-xs text-[#8c95a5]">Ready to view or download</p></div></div>
        {resumes.filter((resume) => resume.status === 'Approved').sort((a, b) => b.version - a.version).slice(0, 3).map((resume) => { const job = jobs.find((item) => item.id === resume.jobId); return <div key={resume.id} className="flex flex-col gap-3 border-b px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{job?.title || 'Job-specific resume'}</p><p className="mt-1 text-xs text-[#8c95a5]">{job?.company} · Version {resume.version} · {formatDate(resume.createdAt)}</p></div><button onClick={() => openJob(resume.jobId)} className="portal-accent-text text-left text-sm font-semibold">View application</button></div>; })}
        {!resumes.some((resume) => resume.status === 'Approved') && <p className="p-5 text-sm text-[#8c95a5]">No approved resumes yet.</p>}
      </section>
    </>
  );
}

function ApplicationsPage({
  jobs,
  resumes,
  openJob,
}: {
  jobs: Job[];
  resumes: ResumeVersion[];
  openJob: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const rows = jobs.filter(
    (job) =>
      `${job.title} ${job.company} ${job.location}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === 'All' || job.status === filter),
  );
  return (
    <>
      <div className="mb-7">
        <p className="portal-accent-text text-[11px] font-semibold uppercase tracking-[0.12em]">
          Your job search
        </p>
        <h1 className="mt-1.5 text-[28px] font-semibold tracking-[-0.04em]">
          Applications
        </h1>
        <p className="mt-1 text-sm text-[#7f899a]">
          Every tracked job and its latest verified status.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex h-10 w-full max-w-sm items-center gap-2 rounded-xl border bg-[#f8f9fb] px-3 text-xs">
            <Search className="size-4" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your applications"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <div className="flex items-center gap-2">
            <ListFilter className="size-4 text-[#7b8496]" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-10 rounded-xl border bg-white px-3 text-xs"
            >
              <option>All</option>
              {[
                'Selected',
                'Pending',
                'Applied',
                'Interview',
                'Rejected',
                'Offer',
                'Failed',
              ].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>
        {rows.map((job) => (
          <ApplicationRow
            key={job.id}
            job={job}
            resume={resumes.find((resume) => resume.jobId === job.id)}
            open={() => openJob(job.id)}
          />
        ))}
        {!rows.length && (
          <div className="py-16 text-center">
            <Search className="mx-auto size-6 text-[#b0b7c3]" />
            <p className="mt-3 text-sm font-semibold">
              No matching applications
            </p>
            <p className="mt-1 text-xs text-[#929aaa]">
              Try a different search or status.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function ResumesPage({
  resumes,
  jobs,
  openResume,
  downloadResume,
  canDownload,
}: {
  resumes: ResumeVersion[];
  jobs: Job[];
  openResume: (resume: ResumeVersion) => void;
  downloadResume: (resume: ResumeVersion, format: 'pdf' | 'docx') => void;
  canDownload: boolean;
}) {
  return (
    <>
      <div className="mb-7">
        <p className="portal-accent-text text-[11px] font-semibold uppercase tracking-[0.12em]">
          Your documents
        </p>
        <h1 className="mt-1.5 text-[28px] font-semibold tracking-[-0.04em]">
          Resumes
        </h1>
        <p className="mt-1 text-sm text-[#7f899a]">
          Approved job-specific resumes and the exact versions used for
          applications.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {resumes.map((resume) => {
          const job = jobs.find((item) => item.id === resume.jobId);
          const used = job?.appliedResumeId === resume.id;
          return (
            <article
              key={resume.id}
              className="overflow-hidden rounded-2xl border bg-white"
            >
              <div className="flex h-36 items-center justify-center bg-[#eef1f5] p-4">
                <div className="h-full w-24 bg-white p-3 shadow">
                  <div className="h-1.5 w-12 bg-[#263044]" />
                  <div className="mt-1 h-1 w-16 bg-[#cbd0d9]" />
                  <div className="mt-3 h-1 w-10 bg-[#606a7d]" />
                  <div className="mt-2 space-y-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-0.5 w-full bg-[#dfe3e9]" />
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[13px] font-semibold">{job?.title}</h2>
                    <p className="mt-1 text-[11px] text-[#8992a3]">
                      {job?.company} · v{resume.version}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[9px] font-semibold ${used ? 'portal-accent-soft' : 'bg-[#eaf8f2] text-[#277e61]'}`}
                  >
                    {used ? 'Used to apply' : 'Approved'}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={() => openResume(resume)}
                    variant="outline"
                    className="h-9 flex-1 rounded-xl text-[10px]"
                  >
                    <FileText className="size-3.5" /> View
                  </Button>
                  {canDownload && (
                    <>
                      <button
                        onClick={() => downloadResume(resume, 'pdf')}
                        className="flex size-9 items-center justify-center rounded-xl border"
                        aria-label="Download PDF"
                      >
                        <Download className="size-3.5" />
                      </button>
                      <button
                        onClick={() => downloadResume(resume, 'docx')}
                        className="flex size-9 items-center justify-center rounded-xl border text-[8px] font-bold"
                        aria-label="Download DOCX"
                      >
                        W
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!resumes.length && (
        <div className="rounded-2xl border bg-white py-16 text-center">
          <FileText className="mx-auto size-7 text-[#b0b7c3]" />
          <p className="mt-3 text-sm font-semibold">No approved resumes yet</p>
          <p className="mt-1 text-xs text-[#929aaa]">
            Approved job-specific versions will appear here automatically.
          </p>
        </div>
      )}
    </>
  );
}

function SkillRow({ item }: { item: SkillPlanItem }) {
  const profile = item.source === 'Profile';
  const missing = item.source === 'Missing';
  return (
    <div className="flex items-center gap-3 border-b border-[#f0f2f5] py-3 last:border-0">
      <span
        className={`flex size-5 items-center justify-center rounded-full ${profile ? 'bg-[#eaf8f2] text-[#267b60]' : missing ? 'bg-[#fff0f2] text-[#b94253]' : 'portal-accent-soft'}`}
      >
        {profile ? (
          <Check className="size-3" />
        ) : missing ? (
          <X className="size-3" />
        ) : (
          <Sparkles className="size-3" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold">{item.name}</p>
        <p className="mt-0.5 text-[9px] text-[#929aaa]">
          {item.required ? 'Mandatory' : 'Preferred'} · {item.detail}
        </p>
      </div>
      <span
        className={`source-badge source-badge--${item.source.toLowerCase().replaceAll(' ', '-').replace('+', 'plus')}`}
      >
        {item.source}
      </span>
    </div>
  );
}

function JobDetail({
  job,
  resume,
  back,
  openResume,
  downloadResume,
}: {
  job: Job;
  resume?: ResumeVersion;
  back: () => void;
  openResume: (resume: ResumeVersion) => void;
  downloadResume: (resume: ResumeVersion, format: 'pdf' | 'docx') => void;
}) {
  const { state } = usePlatform();
  const [detailTab, setDetailTab] = useState<'Overview' | 'JD' | 'Resume' | 'Timeline'>('Overview');
  const events =
    state?.events
      .filter((event) => event.jobId === job.id)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ) ?? [];
  const visible = state!.settings.visibility;
  const plan = resume?.skillPlan ?? [
    ...job.mandatorySkills.map((name) => ({
      name,
      required: true,
      source: 'Missing' as const,
      detail: 'Awaiting resume analysis',
    })),
    ...job.preferredSkills.map((name) => ({
      name,
      required: false,
      source: 'Missing' as const,
      detail: 'Awaiting resume analysis',
    })),
  ];
  return (
    <>
      <button
        onClick={back}
        className="mb-5 flex items-center gap-2 text-[11px] font-semibold text-[#697386]"
      >
        <ArrowLeft className="size-4" /> Back to applications
      </button>
      <header className="rounded-[22px] border bg-white p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div className="flex gap-4">
            <div
              className={`flex size-12 flex-none items-center justify-center rounded-[14px] text-base font-bold ${companyStyle(job.company)}`}
            >
              {job.company[0]}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[23px] font-semibold tracking-[-0.035em] sm:text-[28px]">
                  {job.title}
                </h1>
                <ReadOnlyPill />
              </div>
              <p className="mt-1.5 text-sm font-medium text-[#5d6779]">
                {job.company}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-[#8790a1]">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  {job.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <BriefcaseBusiness className="size-3.5" />
                  {job.workType}
                </span>
                {visible.salary && <span>{job.salary}</span>}
                <span className="flex items-center gap-1.5">
                  <Link2 className="size-3.5" />
                  {job.source}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-5 rounded-2xl bg-[#f7f8fa] px-5 py-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#969eac]">
                Status
              </p>
              <StatusPill status={job.status} />
            </div>
            <div className="h-10 w-px bg-[#e1e4e9]" />
            <div className="text-center">
              <p className="text-[22px] font-bold">{job.matchScore}%</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#969eac]">
                Match
              </p>
            </div>
          </div>
        </div>
      </header>
      <nav className="mt-4 flex gap-1 overflow-x-auto border-b bg-white px-2" aria-label="Application details">
        {(['Overview', 'JD', 'Resume', 'Timeline'] as const).map((item) => <button key={item} onClick={() => setDetailTab(item)} className={`border-b-2 px-4 py-3 text-sm font-semibold ${detailTab === item ? 'portal-accent-text border-current' : 'border-transparent text-[#798294]'}`}>{item}</button>)}
      </nav>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className={`space-y-6 ${detailTab === 'Resume' ? 'hidden' : ''}`}>
          {detailTab === 'Overview' && (
            <section className="rounded-2xl border bg-white p-6 sm:p-8">
              <p className="portal-accent-text text-[10px] font-semibold uppercase tracking-[0.1em]">
                Application overview
              </p>
              <h2 className="mt-1.5 text-lg font-semibold">Your application at a glance</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Status', job.status],
                  ['Match score', `${job.matchScore}%`],
                  ['Applied', formatDate(job.appliedAt)],
                  ['Location', job.location],
                  ['Work type', job.workType],
                  ['Resume', resume ? `Version ${resume.version}` : 'Not generated'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border bg-[#fafbfc] p-4">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#929aaa]">{label}</p>
                    <p className="mt-1.5 text-[12px] font-semibold text-[#465064]">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
          {detailTab === 'JD' && visible.fullJd && (
            <section className="rounded-2xl border bg-white p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="portal-accent-text text-[10px] font-semibold uppercase tracking-[0.1em]">
                    Job description
                  </p>
                  <h2 className="mt-1.5 text-lg font-semibold">Complete JD</h2>
                </div>
                {job.sourceUrl && (
                  <a
                    href={job.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="portal-accent-text flex items-center gap-1.5 text-[10px] font-semibold"
                  >
                    Original job <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <p className="mt-5 whitespace-pre-wrap text-[12px] leading-6 text-[#606a7c]">
                {job.jdText}
              </p>
            </section>
          )}
          {detailTab === 'Timeline' && <section className="rounded-2xl border bg-white p-6 sm:p-8">
            <p className="portal-accent-text text-[10px] font-semibold uppercase tracking-[0.1em]">
              Application timeline
            </p>
            <h2 className="mt-1.5 text-lg font-semibold">
              What happened, and when
            </h2>
            <div className="mt-6">
              {events.map((item, index) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[70px_24px_1fr] gap-2"
                >
                  <p className="pt-0.5 text-[10px] font-semibold text-[#8992a3]">
                    {formatDate(item.createdAt)}
                  </p>
                  <div className="flex flex-col items-center">
                    <span className="portal-accent-bg portal-accent-border mt-0.5 size-3 rounded-full ring-2" />
                    {index < events.length - 1 && (
                      <span className="h-14 w-px bg-[#dfe3e9]" />
                    )}
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-[#465064]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[10px] text-[#929aaa]">
                      {item.detail}
                    </p>
                  </div>
                </div>
              ))}
              {!events.length && (
                <p className="text-xs text-[#929aaa]">
                  No timeline events recorded.
                </p>
              )}
            </div>
          </section>}
          {detailTab === 'Timeline' && <section className="rounded-2xl border border-dashed bg-white p-6">
            <p className="text-xs font-semibold">Coming later</p>
            <p className="mt-2 text-[10px] leading-5 text-[#7b8496]">
              Application questions and answers, recruiter communication, and
              interview details will appear here when those future modules are
              enabled.
            </p>
          </section>}
        </div>
        <aside className={`space-y-5 ${detailTab === 'Resume' ? 'xl:col-span-2' : ''}`}>
          {detailTab === 'Overview' && visible.skillProvenance && (
            <section className="rounded-2xl border bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">JD requirements</h2>
                <span className="rounded-full bg-[#eaf8f2] px-2 py-1 text-[9px] font-semibold text-[#267b60]">
                  {job.matchScore}% covered
                </span>
              </div>
              <div className="mt-3">
                {plan.map((item) => (
                  <SkillRow key={`${item.name}-${item.required}`} item={item} />
                ))}
              </div>
            </section>
          )}
          {detailTab === 'Resume' && resume && (
            <section className="overflow-hidden rounded-2xl border bg-white">
              <div className="border-b bg-[#fafbfc] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#8992a3]">
                  Resume used
                </p>
              </div>
              <div className="p-5">
                <div className="flex gap-3">
                  <div className="portal-accent-soft flex size-10 items-center justify-center rounded-xl">
                    <FileText className="size-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold">
                      {job.company}_{job.title.replaceAll(' ', '_')}.pdf
                    </p>
                    <p className="mt-1 text-[9px] text-[#929aaa]">
                      v{resume.version} · {resume.status}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => openResume(resume)}
                    variant="outline"
                    className="h-9 text-[10px]"
                  >
                    <FileText className="size-3.5" /> View
                  </Button>
                  {visible.resumeDownloads && (
                    <Button
                      onClick={() => downloadResume(resume, 'pdf')}
                      className="portal-accent-bg h-9 text-[10px]"
                    >
                      <Download className="size-3.5" /> PDF
                    </Button>
                  )}
                </div>
                {visible.resumeDownloads && (
                  <button
                    onClick={() => downloadResume(resume, 'docx')}
                    className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border text-[10px] font-semibold"
                  >
                    <Download className="size-3.5" /> Download DOCX
                  </button>
                )}
              </div>
            </section>
          )}
          {detailTab === 'Overview' && <section className="rounded-2xl border bg-white p-5">
            <h2 className="text-sm font-semibold">Resume strategy</h2>
            <div className="mt-4 space-y-3.5">
              {[
                ['Family', job.family],
                ['Target role', job.targetRole],
                ['Target location', job.targetLocation],
                [
                  'Resume version',
                  resume ? `v${resume.version}` : 'Not generated',
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[9px] uppercase tracking-[0.08em] text-[#9aa2b1]">
                    {label}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-[#4b5568]">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>}
          {detailTab === 'Overview' && <section className="rounded-2xl border bg-white p-5">
            <h2 className="text-sm font-semibold">Job record</h2>
            <div className="mt-4 space-y-3">
              {[
                ['Discovered', formatDate(job.discoveredAt)],
                ['Applied', formatDate(job.appliedAt)],
                ['Source', job.source],
                ['Work type', job.workType],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-4 text-[10px]"
                >
                  <span className="text-[#929aaa]">{label}</span>
                  <b className="text-right text-[#4b5568]">{value}</b>
                </div>
              ))}
            </div>
          </section>}
          {detailTab === 'Resume' && !resume && <section className="rounded-2xl border bg-white p-5 text-sm text-[#7b8496]">No approved resume is available for this application yet.</section>}
        </aside>
      </div>
    </>
  );
}

function ResumeDialog({
  resume,
  job,
  open,
  setOpen,
  downloadResume,
  canDownload,
}: {
  resume: ResumeVersion | null;
  job: Job | null;
  open: boolean;
  setOpen: (value: boolean) => void;
  downloadResume: (resume: ResumeVersion, format: 'pdf' | 'docx') => void;
  canDownload: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="corporate-dialog corporate-dialog--resume overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4">
          <div className="pr-10">
            <DialogTitle className="text-sm">
              Resume used for {job?.company}
            </DialogTitle>
            <DialogDescription className="mt-1 text-[11px]">
              {job?.title} · Version {resume?.version}
            </DialogDescription>
          </div>
          {resume && canDownload && (
            <div className="absolute right-14 top-3 flex gap-2">
              <Button
                onClick={() => downloadResume(resume, 'docx')}
                variant="outline"
                className="h-8 text-[10px]"
              >
                <Download className="size-3" /> DOCX
              </Button>
              <Button
                onClick={() => downloadResume(resume, 'pdf')}
                className="portal-accent-bg h-8 text-[10px]"
              >
                <Download className="size-3" /> PDF
              </Button>
            </div>
          )}
        </DialogHeader>
        <div className="overflow-y-auto bg-[#e7eaef] p-5 sm:p-8">
          {resume && <ResumePaper content={resume.content} template={resume.template} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CandidatePortal({
  candidateId,
  exitPreview,
  notify,
}: CandidatePortalProps) {
  const { state, signOutUser, download, fetchFileUrl } = usePlatform();
  const [page, setPage] = useState<CandidatePage>('Overview');
  const [jobId, setJobId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [selectedResume, setSelectedResume] = useState<ResumeVersion | null>(
    null,
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const candidate =
    state?.candidates.find(
      (item) => item.id === (candidateId ?? state.user.candidateId),
    ) ?? state?.candidates[0];
  const jobs =
    state?.jobs.filter((job) => job.candidateId === candidate?.id) ?? [];
  const resumes =
    state?.resumes.filter((resume) => resume.candidateId === candidate?.id) ??
    [];
  const selectedJob = jobs.find((job) => job.id === jobId);
  useEffect(() => {
    let url: string | undefined;
    if (state?.settings.logoFileId)
      void fetchFileUrl(state.settings.logoFileId)
        .then((value) => {
          url = value;
          setLogoUrl(value);
        })
        .catch(() => setLogoUrl(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [state?.settings.logoFileId, fetchFileUrl]);
  const isPreview = Boolean(exitPreview);
  useEffect(() => {
    if (isPreview) return;
    const initial = {
      resumeOS: { view: 'candidate', page: 'Overview', jobId: null },
    };
    if (window.history.state?.resumeOS?.view !== 'candidate') {
      window.history.replaceState(initial, '', '#candidate/overview');
      window.history.pushState(initial, '', '#candidate/overview');
    }
    const restore = (event: PopStateEvent) => {
      const saved = event.state?.resumeOS as
        | { view?: string; page?: CandidatePage; jobId?: string | null }
        | undefined;
      if (saved?.view !== 'candidate') return;
      setPage(saved.page ?? 'Overview');
      setJobId(saved.jobId ?? null);
      setMobileOpen(false);
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [isPreview]);
  if (!state || !candidate) return null;
  const go = (next: CandidatePage) => {
    if (!isPreview && (page !== next || jobId)) {
      window.history.pushState(
        { resumeOS: { view: 'candidate', page: next, jobId: null } },
        '',
        `#candidate/${next.toLowerCase()}`,
      );
    }
    setPage(next);
    setJobId(null);
    setMobileOpen(false);
  };
  const openJob = (id: string) => {
    if (!isPreview) {
      window.history.pushState(
        { resumeOS: { view: 'candidate', page, jobId: id } },
        '',
        `#candidate/job/${encodeURIComponent(id)}`,
      );
    }
    setJobId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const backFromJob = () => {
    if (!isPreview && window.history.state?.resumeOS?.jobId) {
      window.history.back();
      return;
    }
    setJobId(null);
  };
  const openResume = (resume: ResumeVersion) => {
    setSelectedResume(resume);
    setResumeOpen(true);
  };
  const downloadResume = (resume: ResumeVersion, format: 'pdf' | 'docx') =>
    void download({ resumeId: resume.id, format }).catch((error) =>
      notify(
        error instanceof Error ? error.message : 'Download failed.',
        'error',
      ),
    );
  const resumeForJob = (job: Job) =>
    resumes.find((resume) => resume.id === job.appliedResumeId) ??
    resumes
      .filter(
        (resume) => resume.jobId === job.id && resume.status === 'Approved',
      )
      .sort((a, b) => b.version - a.version)[0];
  const nav = (
    ['Overview', 'Applications', 'Resumes'] as CandidatePage[]
  ).filter(
    (item) =>
      state.settings.navigation[
        item.toLowerCase() as keyof typeof state.settings.navigation
      ],
  );
  return (
    <main
      className="portal-theme min-h-screen bg-[#f3f5f8] text-[#1d2638]"
      style={portalThemeStyle(state.settings)}
    >
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex size-9 items-center justify-center rounded-xl border md:hidden"
              aria-label="Open navigation"
            >
              {mobileOpen ? (
                <X className="size-4" />
              ) : (
                <Menu className="size-4" />
              )}
            </button>
            <CandidateBrand logoUrl={logoUrl} />
          </div>
          <nav className="hidden h-full items-center gap-7 md:flex">
            {nav.map((item) => (
              <button
                key={item}
                onClick={() => go(item)}
                className={`relative h-full text-[12px] font-semibold ${page === item && !jobId ? 'portal-accent-text' : 'text-[#798294]'}`}
              >
                {item}
                {page === item && !jobId && (
                  <span
                    className="absolute inset-x-0 bottom-0 h-0.5 rounded-full"
                    style={{ backgroundColor: state.settings.primaryColor }}
                  />
                )}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2.5">
            <div className="hidden items-center gap-2 rounded-xl bg-[#f5f6f9] px-3 py-2 sm:flex">
              <div className="portal-accent-soft flex size-7 items-center justify-center rounded-full text-[9px] font-bold">
                {candidate.initials}
              </div>
              <div>
                <p className="text-[10px] font-semibold">{candidate.name}</p>
                <p className="text-[8px] text-[#949cab]">
                  Candidate · read only
                </p>
              </div>
            </div>
            {exitPreview ? (
              <button
                onClick={exitPreview}
                className="hidden h-9 items-center gap-1.5 rounded-xl border px-3 text-[10px] font-semibold lg:flex"
              >
                <ArrowLeft className="size-3.5" /> Exit preview
              </button>
            ) : (
              <button
                onClick={() => void signOutUser()}
                className="hidden h-9 rounded-xl border px-3 text-[10px] font-semibold sm:block"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
        {mobileOpen && (
          <nav className="border-t bg-white px-5 py-3 md:hidden">
            {nav.map((item) => (
              <button
                key={item}
                onClick={() => go(item)}
                className={`block w-full rounded-xl px-3 py-2.5 text-left text-xs font-semibold ${page === item ? 'portal-accent-soft' : 'text-[#687286]'}`}
              >
                {item}
              </button>
            ))}
            <button
              onClick={exitPreview ?? (() => void signOutUser())}
              className="mt-2 block w-full rounded-xl border px-3 py-2.5 text-left text-xs font-semibold"
            >
              {exitPreview ? 'Exit preview' : 'Sign out'}
            </button>
          </nav>
        )}
      </header>
      <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-6">
        {selectedJob ? (
          <JobDetail
            job={selectedJob}
            resume={resumeForJob(selectedJob)}
            back={backFromJob}
            openResume={openResume}
            downloadResume={downloadResume}
          />
        ) : page === 'Applications' ? (
          <ApplicationsPage jobs={jobs} resumes={resumes} openJob={openJob} />
        ) : page === 'Resumes' ? (
          <ResumesPage
            resumes={resumes}
            jobs={jobs}
            openResume={openResume}
            downloadResume={downloadResume}
            canDownload={state.settings.visibility.resumeDownloads}
          />
        ) : (
          <Overview
            candidate={candidate}
            jobs={jobs}
            resumes={resumes}
            openJob={openJob}
            goApplications={() => go('Applications')}
          />
        )}
      </div>
      <footer className="mt-10 border-t bg-white">
        <div className="mx-auto flex max-w-[1480px] flex-col justify-between gap-3 px-4 py-4 text-xs text-[#949cab] sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-3.5" />
            <span>
              Applications are read only. You control your Gmail connection and sharing preferences.
            </span>
          </div>
          <span>Last synced {formatDate(new Date().toISOString(), true)}</span>
        </div>
      </footer>
      <ResumeDialog
        resume={selectedResume}
        job={jobs.find((job) => job.id === selectedResume?.jobId) ?? null}
        open={resumeOpen}
        setOpen={setResumeOpen}
        downloadResume={downloadResume}
        canDownload={state.settings.visibility.resumeDownloads}
      />
    </main>
  );
}
