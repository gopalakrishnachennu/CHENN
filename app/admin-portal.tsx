'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Activity,
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ClipboardList,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  ExternalLink,
  FileCheck2,
  FileClock,
  FileText,
  Gauge,
  History,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  Menu,
  Palette,
  PencilLine,
  Plus,
  Copy,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  UserPlus,
  UsersRound,
  WandSparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ResumePaper } from '@/components/resume-paper';
import { CandidateWorkspace } from '@/components/candidates/candidate-workspace';
import { ResumeWorkspace } from '@/components/resumes/resume-workspace';
import { JobMatching } from './job-matching';
import { GmailPanel } from './gmail-panel';
import { CareerEditor } from './career-editor';
import { emptyCareer } from '@/lib/career';
import { usePlatform } from '@/lib/platform-context';
import { portalThemeStyle } from '@/lib/portal-theme';
import { evaluateReleaseHealth } from '@/lib/release-health';
import { buildSkillPlan } from '@/lib/server/policy';
import type {
  ApplicationStatus,
  Candidate,
  Job,
  JobFamily,
  PlatformSettings,
  Prompt,
  ResumeContent,
  SkillSource,
  OnboardingSubmission,
} from '@/lib/types';

export type AdminPage =
  | 'Job matching'
  | 'Gmail'
  | 'Overview'
  | 'Candidates'
  | 'Onboarding'
  | 'Jobs & JDs'
  | 'Resume studio'
  | 'Resume history'
  | 'Intelligence'
  | 'Platform'
  | 'Operations';

type AdminPortalProps = {
  activePage: AdminPage;
  setActivePage: (page: AdminPage) => void;
  studioStep: number;
  setStudioStep: (step: number) => void;
  studioJobId: string | null;
  setStudioJobId: (id: string | null) => void;
  previewCandidate: (candidateId: string) => void;
  notify: (message: string, tone?: 'success' | 'error') => void;
};

const primaryNav: { label: AdminPage; title: string; icon: typeof LayoutDashboard }[] = [
  { label: 'Overview', title: 'Home', icon: LayoutDashboard },
  { label: 'Candidates', title: 'Candidates', icon: UsersRound },
  { label: 'Jobs & JDs', title: 'Jobs', icon: BriefcaseBusiness },
  { label: 'Resume studio', title: 'Resumes', icon: FileText },
];
const manageNav: {
  label: AdminPage;
  icon: typeof LayoutDashboard;
  subtitle: string;
}[] = [
  { label: 'Onboarding', icon: UserPlus, subtitle: 'Invites & candidate review' },
  {
    label: 'Intelligence',
    icon: BarChart3,
    subtitle: 'Rules, prompts & taxonomy',
  },
  { label: 'Platform', icon: Settings2, subtitle: 'Brand, access & settings' },
  { label: 'Operations', icon: Activity, subtitle: 'Analytics, logs & tests' },
];

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

function downloadCsv(name: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','),
    )
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-xl bg-[#696bf2] text-white shadow-[0_8px_22px_rgba(105,107,242,.32)]">
        <Sparkles className="size-[18px]" />
      </div>
      <div>
        <div className="text-[15px] font-semibold tracking-[-0.02em] text-white">
          ResumeOS
        </div>
        <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400">
          Operations
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  activePage,
  setActivePage,
  onClose,
}: {
  activePage: AdminPage;
  setActivePage: (page: AdminPage) => void;
  onClose?: () => void;
}) {
  const { state, signOutUser } = usePlatform();
  const go = (page: AdminPage) => {
    setActivePage(page);
    onClose?.();
  };
  return (
    <div className="flex h-full flex-col bg-[#172235] text-white">
      <div className="flex h-[76px] items-center justify-between border-b border-white/8 px-6">
        <Brand />
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-6">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Workspace
        </div>
        <nav aria-label="Admin workspace" className="space-y-1">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const active = item.label === activePage;
            return (
              <button
                key={item.label}
                onClick={() => go(item.label)}
                className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-medium transition ${active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
              >
                <Icon
                  className={`size-[17px] ${active ? 'text-[#a5a6ff]' : ''}`}
                />
                {item.title}
              </button>
            );
          })}
        </nav>
        <div className="mt-7 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Manage
        </div>
        <nav className="space-y-1">
          {manageNav.map((item) => {
            const Icon = item.icon;
            const active = item.label === activePage;
            return (
              <button
                key={item.label}
                onClick={() => go(item.label)}
                className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left ${active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
              >
                <Icon
                  className={`size-[17px] ${active ? 'text-[#a5a6ff]' : ''}`}
                />
                <span>
                  <span className="block text-[13px] font-medium">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">
                    {item.subtitle}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
        <div className="mx-1 mt-8 rounded-2xl border border-white/8 bg-white/[0.04] p-4">
          <div className="mb-3 flex size-8 items-center justify-center rounded-lg bg-[#293855] text-[#aeb0ff]">
            <ShieldCheck className="size-4" />
          </div>
          <p className="text-[12px] font-semibold">Candidate access</p>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">
            Candidates can only read records linked to their verified email.
          </p>
        </div>
      </div>
      <div className="m-3 rounded-2xl border border-white/8 bg-white/[0.04] p-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-[#dfe4ff] text-xs font-bold text-[#4547aa]">
            GC
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">
              {state?.settings.adminName}
            </p>
            <p className="truncate text-[10px] text-slate-500">
              {state?.user.email}
            </p>
          </div>
          <button
            onClick={() => void signOutUser()}
            className="rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-400 hover:bg-white/10 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7174dc]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-[#182033]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-[#7b8496]">{description}</p>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

function Empty({
  icon: Icon = Search,
  title,
  detail,
}: {
  icon?: typeof Search;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <Icon className="mb-3 size-7 text-[#b2b9c6]" />
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-[#929aaa]">{detail}</p>
    </div>
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

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: typeof FileText;
  tone: string;
}) {
  return (
    <article className="rounded-2xl border border-[#e6e9ef] bg-white p-5">
      <div className="mb-5 flex items-start justify-between">
        <div className={`metric-icon metric-icon--${tone}`}>
          <Icon className="size-[18px]" />
        </div>
        <ArrowUpRight className="size-4 text-[#b1b8c5]" />
      </div>
      <p className="text-[13px] font-medium text-[#7b8496]">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="text-[28px] font-semibold tracking-[-0.04em] text-[#1c2435]">
          {value}
        </p>
        <p className="mb-1 text-[11px] text-[#9098a8]">{note}</p>
      </div>
    </article>
  );
}

function AdminOverview({
  openStudio,
  openHistory,
}: {
  openStudio: (step?: number, jobId?: string) => void;
  openHistory: () => void;
}) {
  const { state } = usePlatform();
  if (!state) return null;
  const ready = state.resumes.filter(
    (resume) => resume.status === 'Ready for review',
  ).length;
  const approved = state.resumes.filter(
    (resume) => resume.status === 'Approved',
  ).length;
  const attention =
    state.jobs.filter((job) => job.status === 'Failed').length +
    state.resumes.filter((resume) => resume.scores.recruiterSafe < 90).length;
  const recent = state.resumes.slice(0, 5);
  return (
    <>
      <PageHeading
        eyebrow={new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        }).format(new Date())}
        title={`Good morning, ${state.settings.adminName.split(' ')[0] || 'Admin'}`}
        description="Your complete JD-first resume operation, with every write audited and every candidate view read only."
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Resumes generated"
          value={state.resumes.length}
          note="all versions"
          icon={FileText}
          tone="indigo"
        />
        <MetricCard
          label="Ready for review"
          value={ready}
          note="requires approval"
          icon={Clock3}
          tone="amber"
        />
        <MetricCard
          label="Approved"
          value={approved}
          note="visible to candidates"
          icon={FileCheck2}
          tone="emerald"
        />
        <MetricCard
          label="Needs attention"
          value={attention}
          note="failed or low safety"
          icon={CircleAlert}
          tone="rose"
        />
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_.85fr]">
        <div className="overflow-hidden rounded-2xl border border-[#e6e9ef] bg-white">
          <div className="flex items-center justify-between border-b border-[#eceef3] px-5 py-5 sm:px-6">
            <div>
              <h2 className="text-base font-semibold">
                Recent resume activity
              </h2>
              <p className="mt-1 text-xs text-[#8b94a5]">
                Live generation and approval records
              </p>
            </div>
            <button
              onClick={openHistory}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#5b5de4]"
            >
              View all <ArrowUpRight className="size-3.5" />
            </button>
          </div>
          {recent.length ? (
            <div className="divide-y divide-[#eff1f5]">
              {recent.map((resume) => {
                const job = state.jobs.find((item) => item.id === resume.jobId);
                const candidate = state.candidates.find(
                  (item) => item.id === resume.candidateId,
                );
                return (
                  <button
                    key={resume.id}
                    onClick={() => openStudio(5, resume.jobId)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-[#fafbff] sm:px-6"
                  >
                    <div className="avatar avatar--violet">
                      {candidate?.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">
                        {job?.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#929aaa]">
                        {candidate?.name} · {job?.company} · v{resume.version}
                      </p>
                    </div>
                    <span className="hidden text-[12px] font-bold sm:block">
                      {resume.scores.jdMatch}%
                    </span>
                    <StatusPill status={resume.status} />
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty
              title="No resumes yet"
              detail="Start with a job description to generate the first resume."
            />
          )}
        </div>
        <div className="rounded-2xl bg-[#172235] p-6 text-white shadow-[0_16px_40px_rgba(23,34,53,.14)]">
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-[#aeafff]">
              <WandSparkles className="size-5" />
            </div>
            <span className="rounded-full bg-[#67d4af]/15 px-2.5 py-1 text-[10px] font-semibold text-[#77dfbb]">
              JD-first
            </span>
          </div>
          <h2 className="mt-7 text-xl font-semibold tracking-[-0.035em]">
            Five simple steps. One grounded resume.
          </h2>
          <p className="mt-2 text-[12px] leading-5 text-slate-400">
            Choose a candidate, add the complete JD, resolve skills, select
            strategy, then review and approve.
          </p>
          <div className="my-6 space-y-3">
            {[
              'Candidate',
              'Complete job description',
              'Skill resolution',
              'Resume strategy',
              'Review & approve',
            ].map((label, index) => (
              <div key={label} className="flex items-center gap-3">
                <span className="flex size-6 items-center justify-center rounded-full bg-white/8 text-[10px] font-semibold text-[#aaacff]">
                  {index + 1}
                </span>
                <span className="text-xs text-slate-300">{label}</span>
              </div>
            ))}
          </div>
          <Button
            onClick={() => openStudio(1)}
            className="h-10 w-full rounded-xl bg-[#696bf2] text-xs hover:bg-[#7779f5]"
          >
            Start a new resume <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>
    </>
  );
}

type CandidateDraft = Pick<
  Candidate,
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'headline'
  | 'summary'
  | 'location'
  | 'family'
  | 'status'
  | 'portalEnabled'
  | 'career'
>;
const emptyCandidate = (): CandidateDraft => ({
  id: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  headline: '',
  summary: '',
  location: '',
  family: 'DevOps',
  status: 'Active',
  portalEnabled: true,
  career: emptyCareer(),
});

function CandidateDialog({
  candidate,
  open,
  setOpen,
  notify,
}: {
  candidate: Candidate | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  notify: AdminPortalProps['notify'];
}) {
  const { state, act, busy } = usePlatform();
  const [draft, setDraft] = useState<CandidateDraft>(emptyCandidate());
  useEffect(() => {
    const value = candidate ?? emptyCandidate();
    setDraft({
      id: value.id,
      firstName: value.firstName,
      lastName: value.lastName,
      email: value.email,
      phone: value.phone,
      headline: value.headline,
      summary: value.summary,
      location: value.location,
      family: value.family,
      status: value.status,
      portalEnabled: value.portalEnabled,
      career: value.career ?? emptyCareer(),
    });
  }, [candidate, open]);
  const field = (key: keyof CandidateDraft, value: string | boolean) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (candidate) {
        const result = await act(
          'candidate.update',
          draft as unknown as Record<string, unknown>,
        );
        notify(result.message ?? 'Candidate updated.');
      } else {
        const result = await act(
          'candidate.create',
          draft as unknown as Record<string, unknown>,
        );
        notify(result.message ?? 'Candidate created.');
      }
      setOpen(false);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not save candidate.',
        'error',
      );
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="corporate-dialog overflow-hidden p-0">
        <form onSubmit={save}>
          <DialogHeader className="border-b border-[#eceef3] px-5 py-4">
            <DialogTitle>
              {candidate ? `Manage ${candidate.name}` : 'Add a candidate'}
            </DialogTitle>
            <DialogDescription>
              Capture verified employment, education, certifications, and
              project evidence for accurate resume generation.
            </DialogDescription>
          </DialogHeader>
          <div className="corporate-form-grid corporate-candidate-grid grid sm:grid-cols-2">
            {(
              [
                ['firstName', 'First name'],
                ['lastName', 'Last name'],
                ['email', 'Email address'],
                ['phone', 'Phone'],
                ['location', 'Current location'],
                ['headline', 'Professional headline'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="space-y-1.5">
                <span className="text-xs font-semibold text-[#485164]">
                  {label}{['firstName', 'lastName', 'email', 'phone', 'location'].includes(key) ? ' *' : ''}
                </span>
                <input
                  type={key === 'email' ? 'email' : 'text'}
                  required={['firstName', 'lastName', 'email', 'phone', 'location'].includes(key)}
                  value={String(draft[key])}
                  onChange={(event) => field(key, event.target.value)}
                  className="h-11 w-full rounded-xl border border-[#dfe3ea] px-3.5 text-sm outline-none focus:border-[#7173e8]"
                />
              </label>
            ))}
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-[#485164]">
                Approved job family *
              </span>
              <select
                value={draft.family}
                onChange={(event) => field('family', event.target.value)}
                className="h-11 w-full rounded-xl border border-[#dfe3ea] bg-white px-3.5 text-sm"
              >
                {state?.families
                  .filter((family) => family.active)
                  .map((family) => (
                    <option key={family.id}>{family.name}</option>
                  ))}
                <option>Custom / needs review</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-[#485164]">
                Candidate status
              </span>
              <select
                value={draft.status}
                onChange={(event) => field('status', event.target.value)}
                className="h-11 w-full rounded-xl border border-[#dfe3ea] bg-white px-3.5 text-sm"
              >
                <option>Active</option>
                <option>Paused</option>
                <option>Archived</option>
              </select>
            </label>
            <CareerEditor value={draft.career ?? emptyCareer()} onChange={career => setDraft(current => ({ ...current, career }))} />
            <label className="wide-row flex items-center justify-between rounded-xl border border-[#e3e7ed] p-4 sm:col-span-2">
              <span>
                <span className="block text-xs font-semibold">
                  Candidate portal access
                </span>
                <span className="mt-1 block text-[10px] text-[#8c95a5]">
                  Their verified Google email can view only this record.
                </span>
              </span>
              <input
                aria-label="Candidate portal access"
                type="checkbox"
                checked={draft.portalEnabled}
                onChange={(event) =>
                  field('portalEnabled', event.target.checked)
                }
                className="size-4 accent-[#5b5de4]"
              />
            </label>
          </div>
          <DialogFooter className="border-t border-[#eceef3] px-5 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="bg-[#5b5de4] hover:bg-[#4d4fcf]"
            >
              {busy && <LoaderCircle className="size-4 animate-spin" />} Save
              candidate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OnboardingPage({ notify }: { notify: AdminPortalProps['notify'] }) {
  const { state, act, busy } = usePlatform();
  const [link, setLink] = useState('');
  const [pending, setPending] = useState<OnboardingSubmission | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateDraft, setTemplateDraft] = useState(state?.settings.onboardingForm);
  useEffect(() => { if (state?.settings.onboardingForm) setTemplateDraft(state.settings.onboardingForm); }, [state?.settings.onboardingForm]);
  const createLink = async () => { try { const result = await act('onboarding.invite'); setLink(String(result.link ?? '')); notify('Onboarding link created.'); } catch (e) { notify(e instanceof Error ? e.message : 'Could not create link.', 'error'); } };
  const review = async (action: 'onboarding.approve' | 'onboarding.reject') => { if (!pending) return; try { if (action === 'onboarding.approve') await act('onboarding.approve', { id: pending.id }); else await act('onboarding.reject', { id: pending.id }); setPending(null); notify(action.endsWith('approve') ? 'Candidate onboarded.' : 'Submission rejected.'); } catch (e) { notify(e instanceof Error ? e.message : 'Review failed.', 'error'); } };
  const copy = async (value: string) => { if (value) { await navigator.clipboard.writeText(value); notify('Link copied.'); } };
  const inviteLink = (id: string) => `${window.location.origin}#onboard/${id}`;
  const saveTemplate = async () => { if (!state || !templateDraft) return; try { await act('settings.update', { settings: { ...state.settings, onboardingForm: templateDraft } }); setTemplateOpen(false); notify('Onboarding template saved.'); } catch (e) { notify(e instanceof Error ? e.message : 'Could not save template.', 'error'); } };
  const invites = state?.onboardingInvites ?? [];
  const submissions = state?.onboardingSubmissions ?? [];
  const pendingCount = submissions.filter(item => item.status === 'Pending').length;
  const openCount = invites.filter(item => item.status === 'Open' && item.expiresAtMs > Date.now()).length;
  return <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Candidate onboarding</h1><p className="mt-1 text-sm text-slate-600">Create links, customize the candidate form, and review every response.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setTemplateOpen(open => !open)}><ClipboardList className="size-4" /> Form template</Button><Button onClick={() => void createLink()} disabled={busy}><UserPlus className="size-4" /> Create onboarding link</Button></div></div><div className="grid gap-3 sm:grid-cols-4"><Metric label="Links generated" value={invites.length} /><Metric label="Open links" value={openCount} /><Metric label="Total responses" value={submissions.length} /><Metric label="Pending review" value={pendingCount} /></div>{templateOpen && templateDraft && <div className="rounded-xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Onboarding form template</h2><p className="mt-1 text-sm text-slate-500">New links use this template. Existing links keep their original version.</p></div><Button onClick={() => void saveTemplate()} disabled={busy}><Save className="size-4" /> Save template</Button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Form title<input className="mt-1 w-full rounded-lg border px-3 py-2" value={templateDraft.title} onChange={e => setTemplateDraft({ ...templateDraft, title: e.target.value })} /></label><label className="text-sm font-medium">Subtitle<input className="mt-1 w-full rounded-lg border px-3 py-2" value={templateDraft.subtitle} onChange={e => setTemplateDraft({ ...templateDraft, subtitle: e.target.value })} /></label></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{([['showEducation', 'Show education'], ['showProjects', 'Show projects'], ['showBaseResume', 'Show base resume'], ['requireHeadline', 'Require headline'], ['requireEducation', 'Require education'], ['requireProjects', 'Require projects']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><input type="checkbox" checked={templateDraft[key]} onChange={e => setTemplateDraft({ ...templateDraft, [key]: e.target.checked })} />{label}</label>)}</div></div>} {link && <div className="rounded-xl border border-[#dfe3ff] bg-[#f7f8ff] p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Latest generated link</p><div className="flex flex-wrap items-center gap-2"><input className="min-w-[280px] flex-1 rounded border bg-white px-3 py-2 text-sm" readOnly value={link} /><Button variant="outline" onClick={() => void copy(link)}><Copy className="size-4" /> Copy</Button><Button variant="outline" onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}><ExternalLink className="size-4" /> Open</Button></div></div>}<div className="rounded border bg-white"><div className="border-b px-4 py-3 text-sm font-semibold">Generated links</div>{invites.length ? <div className="divide-y">{invites.map(invite => { const responseCount = submissions.filter(item => item.inviteId === invite.id).length; const expired = invite.status === 'Open' && invite.expiresAtMs <= Date.now(); return <div key={invite.id} className="flex flex-wrap items-center gap-3 px-4 py-4"><div className="min-w-[220px] flex-1"><p className="font-semibold">{formatDate(invite.createdAt, true)}</p><p className="text-xs text-slate-500">Expires {formatDate(invite.expiresAt)} · {responseCount} response{responseCount === 1 ? '' : 's'}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${invite.status === 'Open' && !expired ? 'bg-emerald-50 text-emerald-700' : invite.status === 'Used' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{expired ? 'Expired' : invite.status}</span><Button size="sm" variant="outline" onClick={() => void copy(inviteLink(invite.id))}><Copy className="size-4" /> Copy</Button><Button size="sm" variant="outline" onClick={() => window.open(inviteLink(invite.id), '_blank', 'noopener,noreferrer')}><ExternalLink className="size-4" /> Open</Button></div>; })}</div> : <p className="p-5 text-sm text-slate-500">No links generated yet.</p>}</div><div className="rounded border bg-white"><div className="border-b px-4 py-3 text-sm font-semibold">Responses</div>{submissions.length ? submissions.map(s => <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 last:border-0"><div><p className="font-semibold">{s.firstName} {s.lastName}</p><p className="text-sm text-slate-500">{s.email} · {s.family} · submitted {formatDate(s.submittedAt)}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{s.status}</span>{s.status === 'Pending' && <Button variant="outline" onClick={() => setPending(s)}>Review</Button>}</div></div>) : <p className="p-5 text-sm text-slate-500">No responses yet.</p>}</div><Dialog open={Boolean(pending)} onOpenChange={open => !open && setPending(null)}><DialogContent><DialogHeader><DialogTitle>Review onboarding</DialogTitle><DialogDescription>Approve to create an active candidate. Reject to discard this submission.</DialogDescription></DialogHeader>{pending && <div className="space-y-2 text-sm"><p><strong>{pending.firstName} {pending.lastName}</strong> · {pending.email}</p><p>{pending.phone} · {pending.location} · {pending.family}</p><p className="rounded bg-slate-50 p-3 whitespace-pre-wrap">{pending.career.experience[0]?.responsibilities}</p></div>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => void review('onboarding.reject')}>Reject</Button><Button disabled={busy} onClick={() => void review('onboarding.approve')}>Approve and onboard</Button></DialogFooter></DialogContent></Dialog></section>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded border bg-white p-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>; }

function CandidatesPage({
  previewCandidate,
  openStudio,
  notify,
}: {
  previewCandidate: (id: string) => void;
  openStudio: (step?: number, jobId?: string) => void;
  notify: AdminPortalProps['notify'];
}) {
  const { state, act } = usePlatform();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  if (!state) return null;
  const records = state.candidates.filter(
    (candidate) =>
      `${candidate.name} ${candidate.email} ${candidate.family} ${candidate.location}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === 'All' || candidate.status === status),
  );
  const manage = (candidate: Candidate | null) => {
    setSelected(candidate);
    setOpen(true);
  };
  const archive = async (candidate: Candidate) => {
    if (
      !window.confirm(
        `Archive ${candidate.name}? Their portal access will be disabled. Jobs and resumes remain in the audit history.`,
      )
    )
      return;
    try {
      const result = await act('candidate.archive', { id: candidate.id });
      notify(result.message ?? 'Candidate archived.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not archive candidate.',
        'error',
      );
    }
  };
  const remove = async (candidate: Candidate) => {
    if (
      !window.confirm(
        `Permanently delete ${candidate.name}? This removes all linked jobs, resumes, files, and history and cannot be undone.`,
      )
    )
      return;
    try {
      const result = await act('candidate.delete', { id: candidate.id });
      notify(result.message ?? 'Candidate deleted.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not delete candidate.',
        'error',
      );
    }
  };
  return <>
    <CandidateWorkspace
      candidates={state.candidates}
      jobs={state.jobs}
      resumes={state.resumes}
      selectedId={detailId}
      onSelect={setDetailId}
      onBack={() => setDetailId(null)}
      onCreate={() => manage(null)}
      onEdit={manage}
      onPreview={previewCandidate}
      onGenerate={(_, jobId) => openStudio(1, jobId)}
      onArchive={(candidate) => void archive(candidate)}
      onDelete={(candidate) => void remove(candidate)}
    />
    <CandidateDialog candidate={selected} open={open} setOpen={setOpen} notify={notify} />
  </>;
  /* Legacy list markup retained temporarily below for action parity while the
     new workspace is validated; it is unreachable and can be removed after
     the UI migration settles. */
  return (
    <>
      <PageHeading
        title="Candidates"
        description="Manage profiles, skills, base resumes, job families, locations, and portal access."
        actions={
          <Button
            onClick={() => manage(null)}
            className="h-10 rounded-xl bg-[#5b5de4] px-4 text-xs hover:bg-[#4d4fcf]"
          >
            <Plus className="size-4" /> Add candidate
          </Button>
        }
      />
      <div className="rounded-2xl border border-[#e6e9ef] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#eceef3] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <label className="flex h-10 w-full max-w-sm items-center gap-2 rounded-xl border border-[#e2e6ed] bg-[#f8f9fb] px-3 text-xs text-[#8790a2]">
            <Search className="size-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent outline-none"
              placeholder="Search candidates"
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-10 rounded-xl border border-[#e2e6ed] bg-white px-3 text-xs font-medium"
          >
            <option>All</option>
            <option>Active</option>
            <option>Paused</option>
            <option>Archived</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-[#eff1f5] bg-[#fafbfc] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#929aaa]">
                <th className="px-6 py-3.5">Candidate</th>
                <th className="px-4 py-3.5">Family</th>
                <th className="px-4 py-3.5">Location</th>
                <th className="px-4 py-3.5">Skills</th>
                <th className="px-4 py-3.5">Portal</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((candidate) => (
                <tr
                  key={candidate.id}
                  className="border-b border-[#f0f2f5] last:border-0 hover:bg-[#fafbff]"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="avatar avatar--violet">
                        {candidate.initials}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold">
                          {candidate.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#9aa1af]">
                          {candidate.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-lg bg-[#f1f2ff] px-2.5 py-1 text-[11px] font-semibold text-[#5a5cc8]">
                      {candidate.family}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-[12px] text-[#596275]">
                    {candidate.location || 'Not set'}
                  </td>
                  <td className="px-4 py-4 text-[12px] font-semibold">
                    {candidate.skills.length}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${candidate.portalEnabled ? 'bg-[#eaf8f2] text-[#267b60]' : 'bg-[#f2f3f6] text-[#727b8d]'}`}
                    >
                      {candidate.portalEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => previewCandidate(candidate.id)}
                        disabled={candidate.status === 'Archived'}
                        className="rounded-lg border border-[#e3e7ed] px-3 py-1.5 text-[10px] font-semibold disabled:opacity-40"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => manage(candidate)}
                        className="rounded-lg border border-[#e3e7ed] px-3 py-1.5 text-[10px] font-semibold"
                      >
                        Manage
                      </button>
                      <button
                        onClick={() => void archive(candidate)}
                        disabled={candidate.status === 'Archived'}
                        aria-label={`Archive ${candidate.name}`}
                        className="flex size-8 items-center justify-center rounded-lg text-[#8a6a35] hover:bg-[#fff8eb] disabled:opacity-30"
                      >
                        <Archive className="size-3.5" />
                      </button>
                      <button
                        onClick={() => void remove(candidate)}
                        aria-label={`Permanently delete ${candidate.name}`}
                        className="flex size-8 items-center justify-center rounded-lg text-[#a04b58] hover:bg-[#fff0f2]"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!records.length && (
            <Empty
              title="No candidates found"
              detail="Try a different search or create a candidate."
            />
          )}
        </div>
      </div>
      <CandidateDialog
        candidate={selected}
        open={open}
        setOpen={setOpen}
        notify={notify}
      />
    </>
  );
}

type JobDraft = {
  id: string;
  candidateId: string;
  company: string;
  title: string;
  location: string;
  workType: string;
  salary: string;
  source: string;
  sourceUrl: string;
  jdText: string;
  mandatorySkills: string;
  preferredSkills: string;
  targetRole: string;
  targetLocation: string;
  family: string;
  status: ApplicationStatus;
};
function emptyJob(candidate?: Candidate): JobDraft {
  return {
    id: '',
    candidateId: candidate?.id ?? '',
    company: '',
    title: '',
    location: candidate?.location ?? '',
    workType: 'Hybrid',
    salary: 'Not listed',
    source: 'Manual',
    sourceUrl: '',
    jdText: '',
    mandatorySkills: '',
    preferredSkills: '',
    targetRole: '',
    targetLocation: candidate?.location ?? '',
    family: candidate?.family ?? 'DevOps',
    status: 'Selected',
  };
}
function draftFromJob(job: Job): JobDraft {
  return {
    ...job,
    mandatorySkills: job.mandatorySkills.join(', '),
    preferredSkills: job.preferredSkills.join(', '),
  };
}

function JobDialog({
  job,
  open,
  setOpen,
  notify,
  afterCreate,
}: {
  job: Job | null;
  open: boolean;
  setOpen: (value: boolean) => void;
  notify: AdminPortalProps['notify'];
  afterCreate?: (id: string) => void;
}) {
  const { state, act, busy } = usePlatform();
  const [draft, setDraft] = useState<JobDraft>(emptyJob(state?.candidates[0]));
  useEffect(() => {
    setDraft(job ? draftFromJob(job) : emptyJob(state?.candidates[0]));
  }, [job, open, state?.candidates]);
  const set = (key: keyof JobDraft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await act(
        job ? 'job.update' : 'job.create',
        draft as unknown as Record<string, unknown>,
      );
      notify(result.message ?? 'Job saved.');
      setOpen(false);
      if (!job && result.id) afterCreate?.(String(result.id));
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not save job.',
        'error',
      );
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="corporate-dialog overflow-hidden p-0">
        <form onSubmit={save}>
          <DialogHeader className="border-b border-[#eceef3] px-5 py-4">
            <DialogTitle>
              {job ? `Edit ${job.title}` : 'Add a job description'}
            </DialogTitle>
            <DialogDescription>
              The full JD drives family detection, skill resolution, match
              scoring, and resume strategy.
            </DialogDescription>
          </DialogHeader>
          <div className="corporate-form-grid corporate-job-grid grid sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold">Candidate</span>
              <select
                required
                value={draft.candidateId}
                disabled={Boolean(job)}
                onChange={(event) => {
                  const candidate = state?.candidates.find(
                    (item) => item.id === event.target.value,
                  );
                  setDraft((current) => ({
                    ...current,
                    candidateId: event.target.value,
                    family: candidate?.family ?? current.family,
                    location: current.location || candidate?.location || '',
                    targetLocation:
                      current.targetLocation || candidate?.location || '',
                  }));
                }}
                className="h-11 w-full rounded-xl border border-[#dfe3ea] bg-white px-3.5 text-sm"
              >
                {state?.candidates.map((candidate) => (
                  <option value={candidate.id} key={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold">Job family *</span>
              <select
                value={draft.family}
                onChange={(event) => set('family', event.target.value)}
                className="h-11 w-full rounded-xl border border-[#dfe3ea] bg-white px-3.5 text-sm"
              >
                {state?.families.map((family) => (
                  <option key={family.id}>{family.name}</option>
                ))}
              </select>
            </label>
            {(
              [
                ['company', 'Company'],
                ['title', 'Job title'],
                ['location', 'Job location'],
                ['workType', 'Work type'],
                ['salary', 'Salary'],
                ['source', 'Job source'],
                ['sourceUrl', 'Job URL'],
                ['targetRole', 'Target role'],
                ['targetLocation', 'Target location'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="space-y-1.5">
                <span className="text-xs font-semibold">{label}{['company', 'title', 'location', 'workType', 'targetRole', 'targetLocation', 'salary', 'sourceUrl'].includes(key) ? ' *' : ''}</span>
                <input
                  required={['company', 'title', 'location', 'workType', 'targetRole', 'targetLocation', 'salary', 'sourceUrl'].includes(key)}
                  type={key === 'sourceUrl' ? 'url' : 'text'}
                  value={draft[key]}
                  onChange={(event) => set(key, event.target.value)}
                  className="h-11 w-full rounded-xl border border-[#dfe3ea] px-3.5 text-sm"
                />
              </label>
            ))}
            <label className="space-y-1.5">
              <span className="text-xs font-semibold">Application status</span>
              <select
                value={draft.status}
                onChange={(event) => set('status', event.target.value)}
                className="h-11 w-full rounded-xl border border-[#dfe3ea] bg-white px-3.5 text-sm"
              >
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
            </label>
            <label className="full-row space-y-1.5 sm:col-span-2">
              <span className="text-xs font-semibold">
                Complete job description
              </span>
              <textarea
                required
                value={draft.jdText}
                onChange={(event) => set('jdText', event.target.value)}
                className="min-h-40 w-full rounded-xl border border-[#dfe3ea] px-3.5 py-3 text-sm leading-6"
                placeholder="Paste the complete JD…"
              />
            </label>
            <label className="half-row space-y-1.5">
              <span className="text-xs font-semibold">
                Mandatory skills (comma separated)
              </span>
              <textarea
                value={draft.mandatorySkills}
                onChange={(event) => set('mandatorySkills', event.target.value)}
                className="min-h-20 w-full rounded-xl border border-[#dfe3ea] px-3 py-2 text-xs"
                placeholder="Leave blank for automatic detection"
              />
            </label>
            <label className="half-row space-y-1.5">
              <span className="text-xs font-semibold">
                Preferred skills (comma separated)
              </span>
              <textarea
                value={draft.preferredSkills}
                onChange={(event) => set('preferredSkills', event.target.value)}
                className="min-h-20 w-full rounded-xl border border-[#dfe3ea] px-3 py-2 text-xs"
                placeholder="Leave blank for automatic detection"
              />
            </label>
          </div>
          <DialogFooter className="border-t border-[#eceef3] px-5 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="bg-[#5b5de4] hover:bg-[#4d4fcf]"
            >
              {busy && <LoaderCircle className="size-4 animate-spin" />} Save &
              analyze JD
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function JobsPage({
  openStudio,
  openMatching,
  notify,
}: {
  openStudio: (step?: number, jobId?: string) => void;
  openMatching: () => void;
  notify: AdminPortalProps['notify'];
}) {
  const { state, act } = usePlatform();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Job | null>(null);
  if (!state) return null;
  const candidateName = (id: string) =>
    state.candidates.find((item) => item.id === id)?.name ??
    'Archived candidate';
  const rows = state.jobs.filter(
    (job) =>
      `${job.company} ${job.title} ${candidateName(job.candidateId)}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === 'All' || job.status === filter),
  );
  const updateStatus = async (job: Job, status: string) => {
    try {
      const result = await act('job.status', { id: job.id, status });
      notify(result.message ?? 'Status updated.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not update status.',
        'error',
      );
    }
  };
  const remove = async (job: Job) => {
    if (
      !window.confirm(
        `Delete ${job.title} at ${job.company}? Generated resume versions and timeline events for this job will also be deleted.`,
      )
    )
      return;
    try {
      const result = await act('job.delete', { id: job.id });
      notify(result.message ?? 'Job deleted.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not delete job.',
        'error',
      );
    }
  };
  return (
    <>
      <PageHeading
        title="Jobs & job descriptions"
        description="Manage complete JDs, requirement analysis, job-specific resumes, and application status."
        actions={
          <>
            <Button
              variant="outline"
              onClick={openMatching}
              className="h-10 rounded-xl text-xs"
            >
              <UploadCloud className="size-4" /> Add/import JD
            </Button>
            <Button
              onClick={openMatching}
              className="h-10 rounded-xl bg-[#5b5de4] text-xs hover:bg-[#4d4fcf]"
            >
              <Plus className="size-4" /> Job matching
            </Button>
          </>
        }
      />
      <div className="rounded-2xl border border-[#e6e9ef] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#eceef3] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <label className="flex h-10 w-full max-w-sm items-center gap-2 rounded-xl border border-[#e2e6ed] bg-[#f8f9fb] px-3 text-xs text-[#8790a2]">
            <Search className="size-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent outline-none"
              placeholder="Search role, company, candidate"
            />
          </label>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="h-10 rounded-xl border border-[#e2e6ed] bg-white px-3 text-xs font-medium"
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left">
            <thead>
              <tr className="border-b border-[#eff1f5] bg-[#fafbfc] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#929aaa]">
                <th className="px-6 py-3.5">Job</th>
                <th className="px-4 py-3.5">Candidate</th>
                <th className="px-4 py-3.5">Requirements</th>
                <th className="px-4 py-3.5">Match</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((job) => (
                <tr
                  key={job.id}
                  className="border-b border-[#f0f2f5] last:border-0 hover:bg-[#fafbff]"
                >
                  <td className="px-6 py-4">
                    <p className="text-[13px] font-semibold">{job.title}</p>
                    <p className="mt-0.5 text-[11px] text-[#9aa1af]">
                      {job.company} · {job.location}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-[12px] font-medium">
                    {candidateName(job.candidateId)}
                  </td>
                  <td className="px-4 py-4 text-[11px] text-[#697386]">
                    {job.mandatorySkills.length} mandatory ·{' '}
                    {job.preferredSkills.length} preferred
                  </td>
                  <td className="px-4 py-4 text-[13px] font-bold">
                    {job.matchScore}%
                  </td>
                  <td className="px-4 py-4">
                    <select
                      aria-label={`Status for ${job.title}`}
                      value={job.status}
                      onChange={(event) =>
                        void updateStatus(job, event.target.value)
                      }
                      className="h-8 rounded-lg border border-[#dfe3ea] bg-white px-2 text-[11px] font-semibold"
                    >
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
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() =>
                          openStudio(
                            state.resumes.some(
                              (resume) => resume.jobId === job.id,
                            )
                              ? 5
                              : 3,
                            job.id,
                          )
                        }
                        className="rounded-lg border border-[#e2e6ed] px-3 py-1.5 text-[10px] font-semibold"
                      >
                        {state.resumes.some((resume) => resume.jobId === job.id)
                          ? 'View resume'
                          : 'Generate'}
                      </button>
                      <button
                        aria-label={`Edit ${job.title} at ${job.company}`}
                        onClick={() => {
                          setSelected(job);
                          setOpen(true);
                        }}
                        className="flex size-8 items-center justify-center rounded-lg border border-[#e2e6ed]"
                      >
                        <PencilLine className="size-3.5" />
                      </button>
                      <button
                        aria-label={`Delete ${job.title} at ${job.company}`}
                        onClick={() => void remove(job)}
                        className="flex size-8 items-center justify-center rounded-lg text-[#a04b58] hover:bg-[#fff0f2]"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <Empty
              title="No matching jobs"
              detail="Import a complete job description to start the JD-first workflow."
            />
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">JDs are shared catalog records. Candidate applications appear here only after an admin approves a match.</p>
    </>
  );
}

function SourceBadge({ source }: { source: SkillSource }) {
  const icons = {
    Profile: CheckCircle2,
    'JD + Family': Sparkles,
    Supporting: WandSparkles,
    Missing: CircleAlert,
  };
  const Icon = icons[source];
  return (
    <span
      className={`source-badge source-badge--${source.toLowerCase().replaceAll(' ', '-').replace('+', 'plus')}`}
    >
      <Icon className="size-3" />
      {source}
    </span>
  );
}
const wizardSteps = [
  'Candidate',
  'Job description',
  'Skill plan',
  'Strategy',
  'Review & approve',
];

function ResumeStudio({
  step,
  openMatching,
  setStep,
  jobId,
  setJobId,
  notify,
}: {
  step: number;
  openMatching: () => void;
  setStep: (step: number) => void;
  jobId: string | null;
  setJobId: (id: string | null) => void;
  notify: AdminPortalProps['notify'];
}) {
  const { state, act, download, busy } = usePlatform();
  const [candidateId, setCandidateId] = useState('');
  const [draft, setDraft] = useState<JobDraft>(emptyJob());
  const [template, setTemplate] = useState('Modern ATS');
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState<ResumeContent | null>(null);
  const job = state?.jobs.find((item) => item.id === jobId);
  const candidate = state?.candidates.find(
    (item) => item.id === (job?.candidateId ?? candidateId),
  );
  const family = state?.families.find(
    (item) => item.name === (job?.family ?? candidate?.family),
  );
  const resumes =
    state?.resumes
      .filter((resume) => resume.jobId === jobId)
      .sort((a, b) => b.version - a.version) ?? [];
  const resume = resumes[0];
  const plan =
    resume?.skillPlan ??
    (job && candidate
      ? buildSkillPlan(
          candidate.skills,
          family,
          job.mandatorySkills,
          job.preferredSkills,
          {
            allowFamilyContext:
              state?.settings.guardrails.familyMatch &&
              candidate.family.toLowerCase() === job.family.toLowerCase(),
            allowSupportingContext:
              state?.settings.guardrails.supportingContext,
          },
        )
      : []);
  useEffect(() => {
    if (!candidateId && state?.candidates[0])
      setCandidateId(state.candidates[0].id);
  }, [candidateId, state?.candidates]);
  useEffect(() => {
    if (!jobId && candidate) setDraft(emptyJob(candidate));
  }, [candidate?.id, jobId]);
  useEffect(() => {
    if (job) {
      setDraft(draftFromJob(job));
      setTemplate(
        resume?.template ?? state?.settings.templates[0] ?? 'Modern ATS',
      );
    }
  }, [job?.id, resume?.id, state?.settings.templates]);
  if (!state) return null;
  const createJob = async () => {
    try {
      const result = await act('job.create', {
        ...draft,
        candidateId,
        family: draft.family || candidate?.family,
      });
      const id = String(result.id);
      setJobId(id);
      setStep(3);
      notify(result.message ?? 'JD analyzed.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not analyze the JD.',
        'error',
      );
    }
  };
  const generate = async () => {
    if (!jobId || !job) return;
    try {
      if (
        draft.targetRole !== job.targetRole ||
        draft.targetLocation !== job.targetLocation
      )
        await act('job.update', draft as unknown as Record<string, unknown>);
      const result = await act('resume.generate', { jobId, template });
      setStep(5);
      notify(result.message ?? 'Resume generated.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not generate resume.',
        'error',
      );
    }
  };
  const approve = async () => {
    if (!resume) return;
    try {
      if (resume.aiMetadata && !window.confirm('Have you reviewed the AI wording, source evidence, qualifications, employer claims and metrics for factual accuracy?')) return;
      const result = await act('resume.approve', { id: resume.id, factualReviewConfirmed: Boolean(resume.aiMetadata) });
      notify(result.message ?? 'Resume approved.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not approve resume.',
        'error',
      );
    }
  };
  const saveEdit = async () => {
    if (!resume || !editContent) return;
    try {
      const result = await act('resume.edit', {
        id: resume.id,
        content: editContent,
      });
      setEditing(false);
      notify(result.message ?? 'Resume version saved.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not save edits.',
        'error',
      );
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="Resume studio"
        title={
          step === 5 ? 'Review the tailored resume' : 'Create a new resume'
        }
        description="A simple, auditable path from complete job description to approved candidate resume."
        actions={resume && <StatusPill status={resume.status} />}
      />
      <div className="mb-6 overflow-x-auto rounded-2xl border border-[#e6e9ef] bg-white px-5 py-4">
        <div className="flex min-w-[720px] items-center">
          {wizardSteps.map((label, index) => {
            const number = index + 1;
            const complete = number < step;
            const active = number === step;
            return (
              <div
                key={label}
                className="flex flex-1 items-center last:flex-none"
              >
                <button
                  disabled={number === 2 || number > step || (number > 2 && !jobId)}
                  onClick={() => number !== 2 && setStep(number)}
                  className="flex items-center gap-2.5"
                >
                  <span
                    className={`flex size-7 items-center justify-center rounded-full border text-[10px] font-bold ${complete ? 'border-[#4aa884] bg-[#4aa884] text-white' : active ? 'border-[#6466e7] bg-[#6466e7] text-white ring-4 ring-[#6466e7]/10' : 'border-[#dfe3ea] text-[#929aaa]'}`}
                  >
                    {complete ? <Check className="size-3.5" /> : number}
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${active ? 'text-[#353e51]' : 'text-[#929aaa]'}`}
                  >
                    {label}
                  </span>
                </button>
                {index < 4 && (
                  <div
                    className={`mx-4 h-px flex-1 ${complete ? 'bg-[#79bfa5]' : 'bg-[#e4e7ed]'}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      {step === 1 && (
        <section className="rounded-2xl border border-[#e6e9ef] bg-white p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7679dc]">
            Step 1 of 5
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            Choose an approved job match
          </h2>
          <p className="mt-1 text-sm text-[#858e9f]">
            Resume generation starts only after a shared JD has been matched and
            approved for a candidate in Job matching.
          </p>
          <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {state.jobs.filter((item) => Boolean(item.catalogId)).map((item) => {
              const matchedCandidate = state.candidates.find((candidateItem) => candidateItem.id === item.candidateId);
              return (
              <button
                key={item.id}
                onClick={() => {
                  setJobId(item.id);
                  setCandidateId(item.candidateId);
                  setDraft(draftFromJob(item));
                  setStep(3);
                }}
                className="flex items-center gap-3 rounded-2xl border border-[#e5e8ee] p-4 text-left"
              >
                <div className="avatar avatar--violet">{matchedCandidate?.initials ?? 'JD'}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">
                    {item.company} · {item.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#929aaa]">
                    {matchedCandidate?.name ?? 'Candidate'} · {item.family} · {item.status}
                  </p>
                </div>
                <ArrowRight className="size-4 text-[#5b5de4]" />
              </button>
              );
            })}
            {!state.jobs.some((item) => item.catalogId) && <Empty icon={FileText} title="No approved matches yet" detail="Approve a candidate match in Job matching first." />}
          </div>
        </section>
      )}
      {step === 2 && (
        <section className="grid gap-6 xl:grid-cols-[1fr_330px]">
          <div className="rounded-2xl border border-[#e6e9ef] bg-white p-6 sm:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dfe8ff] bg-[#f7f8ff] p-4 text-sm text-[#4c5870]">
              <span>JDs are shared catalog records now. Add/import this JD in Job matching, approve its candidate matches, then return here to generate a resume.</span>
              <Button type="button" variant="outline" onClick={openMatching}>Open Job matching</Button>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7679dc]">
              Step 2 of 5
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              Add the complete job description
            </h2>
            <p className="mt-1 text-sm text-[#858e9f]">
              The JD is the primary source for every decision.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['company', 'Company'],
                  ['title', 'Job title'],
                  ['location', 'Location'],
                  ['workType', 'Work type'],
                  ['salary', 'Salary'],
                  ['source', 'Source'],
                  ['sourceUrl', 'Job URL'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="space-y-1.5">
                  <span className="text-xs font-semibold">{label}{['company', 'title', 'salary', 'sourceUrl'].includes(key) ? ' *' : ''}</span>
                  <input
                    required={['company', 'title', 'salary', 'sourceUrl'].includes(key)}
                    type={key === 'sourceUrl' ? 'url' : 'text'}
                    value={draft[key]}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [key]: event.target.value,
                        ...(key === 'title' && !current.targetRole
                          ? { targetRole: event.target.value }
                          : {}),
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-[#dfe3ea] px-3.5 text-sm"
                  />
                </label>
              ))}
              <label className="space-y-1.5">
                <span className="text-xs font-semibold">Family</span>
                <select
                  value={draft.family}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      family: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-[#dfe3ea] bg-white px-3.5 text-sm"
                >
                  {state.families.map((item) => (
                    <option key={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold">Complete JD</span>
                <textarea
                  value={draft.jdText}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      jdText: event.target.value,
                    }))
                  }
                  className="min-h-56 w-full rounded-xl border border-[#dfe3ea] px-3.5 py-3 text-sm leading-6"
                />
              </label>
            </div>
          </div>
          <aside className="rounded-2xl border border-[#dfe8ff] bg-[#f7f8ff] p-6">
            <TargetCard />
          </aside>
        </section>
      )}
      {step === 3 && job && (
        <section className="grid gap-6 xl:grid-cols-[1fr_330px]">
          <div className="rounded-2xl border border-[#e6e9ef] bg-white p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-3 sm:flex-row">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7679dc]">
                  Step 3 of 5
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  Review the skill plan
                </h2>
                <p className="mt-1 text-sm text-[#858e9f]">
                  Every requirement has a visible, recruiter-safe source.
                </p>
              </div>
              <span className="h-fit rounded-full bg-[#eaf8f2] px-3 py-1.5 text-[10px] font-semibold text-[#267b60]">
                {
                  plan.filter(
                    (item) => item.required && item.source === 'Profile',
                  ).length
                }{' '}
                / {plan.filter((item) => item.required).length} mandatory
                profile-backed
              </span>
            </div>
            <div className="mt-6 space-y-2.5">
              {plan.map((item) => (
                <div
                  key={`${item.name}-${item.required}`}
                  className="flex items-center gap-3 rounded-xl border border-[#e7eaf0] p-4"
                >
                  <div
                    className={`flex size-8 items-center justify-center rounded-lg ${item.source === 'Profile' ? 'bg-[#eaf8f2] text-[#217c60]' : item.source === 'Missing' ? 'bg-[#fff0f2] text-[#b94253]' : 'bg-[#f1f2ff] text-[#5b5dd0]'}`}
                  >
                    {item.source === 'Profile' ? (
                      <Check className="size-4" />
                    ) : item.source === 'Missing' ? (
                      <X className="size-4" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">
                      {item.name}{' '}
                      <span className="text-[9px] font-medium text-[#929aaa]">
                        {item.required ? 'MANDATORY' : 'PREFERRED'}
                      </span>
                    </p>
                    <p className="mt-1 text-[10px] text-[#929aaa]">
                      {item.detail}
                    </p>
                  </div>
                  <SourceBadge source={item.source} />
                </div>
              ))}
            </div>
          </div>
          <aside className="space-y-4">
            <div className="rounded-2xl border border-[#e6e9ef] bg-white p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#929aaa]">
                Detected strategy
              </p>
              {[
                ['Candidate', candidate?.name],
                ['Family', job.family],
                ['Role', job.targetRole],
                ['Location', job.targetLocation],
              ].map(([label, value]) => (
                <div key={label} className="mt-4">
                  <p className="text-[9px] text-[#9aa2b1]">{label}</p>
                  <p className="mt-1 text-xs font-semibold">
                    {value || 'Not set'}
                  </p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-[#f1debf] bg-[#fffbf4] p-5">
              <div className="flex items-center gap-2 text-[#9d641d]">
                <ShieldCheck className="size-4" />
                <p className="text-xs font-semibold">Recruiter-safe</p>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-[#806c52]">
                Family skills can support alignment, but the resume never states
                prior employment evidence unless it exists in the profile or
                base resume.
              </p>
            </div>
          </aside>
        </section>
      )}
      {step === 4 && job && (
        <section className="grid gap-6 xl:grid-cols-[1fr_330px]">
          <div className="rounded-2xl border border-[#e6e9ef] bg-white p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7679dc]">
              Step 4 of 5
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              Choose the resume strategy
            </h2>
            <p className="mt-1 text-sm text-[#858e9f]">
              Confirm the role, location, template, and generation engine.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold">Target role</span>
                <input
                  value={draft.targetRole}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      targetRole: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-[#dfe3ea] px-3.5 text-sm"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold">Target location</span>
                <input
                  value={draft.targetLocation}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      targetLocation: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-[#dfe3ea] px-3.5 text-sm"
                />
              </label>
            </div>
            <p className="mb-3 mt-7 text-xs font-semibold">Resume template</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {state.settings.templates.map((item) => (
                <button
                  key={item}
                  onClick={() => setTemplate(item)}
                  className={`rounded-2xl border p-4 text-left ${template === item ? 'border-[#6769e2] bg-[#f7f7ff] ring-3 ring-[#6769e2]/8' : 'border-[#e4e8ee]'}`}
                >
                  <FileText className="size-5 text-[#5b5dd0]" />
                  <p className="mt-5 text-xs font-semibold">{item}</p>
                  <p className="mt-1 text-[9px] text-[#929aaa]">
                    ATS-safe layout
                  </p>
                </button>
              ))}
            </div>
          </div>
          <aside className="space-y-4">
            <div className="rounded-2xl border border-[#e6e9ef] bg-white p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold">Generation engine</h3>
                <span
                  className={`rounded-full px-2 py-1 text-[8px] font-bold ${state.credential.connected ? 'bg-[#eaf8f2] text-[#267b60]' : 'bg-[#fff4e6] text-[#ad691e]'}`}
                >
                  {state.credential.connected
                    ? 'OPENAI CONNECTED'
                    : 'SAFE FALLBACK'}
                </span>
              </div>
              <p className="mt-3 text-[10px] leading-4 text-[#7b8496]">
                {state.credential.connected
                  ? 'The key stays on this administrator browser and is used only for the generation request. Output remains evidence checked.'
                  : 'Generation still works with deterministic, evidence-only content. Connect OpenAI in Platform settings when ready.'}
              </p>
            </div>
            <div className="rounded-2xl border border-[#d9ede6] bg-[#f6fcfa] p-5">
              <div className="flex items-center gap-2 text-[#287c62]">
                <LockKeyhole className="size-4" />
                <p className="text-xs font-semibold">No fabricated claims</p>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-[#627b72]">
                Employers, dates, credentials, metrics, and experience bullets
                remain grounded in approved evidence.
              </p>
            </div>
          </aside>
        </section>
      )}
      {step === 5 && (
        <>
          {resume ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
              <section className="overflow-hidden rounded-2xl border border-[#dfe3ea] bg-[#e8ebf0]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dfe3e9] bg-white px-4 py-3">
                  <div>
                    <p className="text-[11px] font-semibold">
                      {candidate?.name}_{job?.company}_{job?.title}.pdf
                    </p>
                    <p className="mt-0.5 text-[9px] text-[#929aaa]">
                      Version {resume.version} · {resume.engine}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      onClick={() => {
                        setEditContent(structuredClone(resume.content));
                        setEditing(true);
                      }}
                      variant="outline"
                      className="h-8 text-[10px]"
                    >
                      <PencilLine className="size-3" /> Edit
                    </Button>
                    <Button
                      onClick={() =>
                        void download({
                          resumeId: resume.id,
                          format: 'pdf',
                        }).catch((error) => notify(error.message, 'error'))
                      }
                      variant="outline"
                      className="h-8 text-[10px]"
                    >
                      <Download className="size-3" /> PDF
                    </Button>
                    <Button
                      onClick={() =>
                        void download({
                          resumeId: resume.id,
                          format: 'docx',
                        }).catch((error) => notify(error.message, 'error'))
                      }
                      variant="outline"
                      className="h-8 text-[10px]"
                    >
                      <Download className="size-3" /> DOCX
                    </Button>
                  </div>
                </div>
                <div className="max-h-[780px] overflow-y-auto p-4 sm:p-7">
                  <ResumePaper content={resume.content} template={resume.template} />
                </div>
              </section>
              <aside className="space-y-4">
                <div className="rounded-2xl border border-[#e6e9ef] bg-white p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-xs font-semibold">Quality scores</h3>
                    <Gauge className="size-4 text-[#8b94a5]" />
                  </div>
                  {Object.entries(resume.scores).map(([label, value]) => (
                    <div key={label} className="mb-4 last:mb-0">
                      <div className="mb-1.5 flex justify-between">
                        <span className="text-[10px] capitalize text-[#697386]">
                          {label.replace(/([A-Z])/g, ' $1')}
                        </span>
                        <span className="text-[10px] font-bold">{value}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#edf0f4]">
                        <div
                          className="h-full rounded-full bg-[#5b5de4]"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-[#d9ede6] bg-[#f6fcfa] p-5">
                  <div className="flex items-center gap-2 text-[#287c62]">
                    <ShieldCheck className="size-4" />
                    <h3 className="text-xs font-semibold">
                      Recruiter-safe review
                    </h3>
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-[#627b72]">
                    Every included skill shows its origin. Missing skills are
                    not turned into experience claims.
                  </p>
                </div>
                {resume.status === 'Approved' ? (
                  <div className="rounded-2xl bg-[#eaf8f2] p-5 text-center">
                    <CheckCircle2 className="mx-auto size-6 text-[#278364]" />
                    <p className="mt-2 text-xs font-semibold text-[#21694f]">
                      Approved & published
                    </p>
                    <p className="mt-1 text-[10px] text-[#5f7e72]">
                      Visible in the candidate’s read-only portal.
                    </p>
                  </div>
                ) : (
                  <Button
                    onClick={() => void approve()}
                    disabled={busy}
                    className="h-11 w-full rounded-xl bg-[#238465] text-xs hover:bg-[#1c7156]"
                  >
                    <CheckCircle2 className="size-4" /> Approve & publish
                  </Button>
                )}
                <Button
                  onClick={() => void generate()}
                  disabled={busy}
                  variant="outline"
                  className="h-10 w-full rounded-xl text-xs"
                >
                  <RefreshCw className="size-4" /> Regenerate new version
                </Button>
              </aside>
            </div>
          ) : (
            <Empty
              icon={FileText}
              title="No resume version yet"
              detail="Return to strategy and generate the first version."
            />
          )}
        </>
      )}
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-[#e6e9ef] bg-white p-4">
        <Button
          variant="outline"
          disabled={step === 1 || busy}
          onClick={() => setStep(step === 3 ? 1 : Math.max(1, step - 1))}
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        {step === 1 && <Button variant="outline" onClick={openMatching}>Open Job matching</Button>}
        {step === 2 && (
          <Button
            disabled={!draft.company || !draft.title || !draft.jdText || busy}
            onClick={() => void createJob()}
            className="bg-[#5b5de4]"
          >
            Analyze JD <ArrowRight className="size-4" />
          </Button>
        )}
        {step === 3 && (
          <Button onClick={() => setStep(4)} className="bg-[#5b5de4]">
            Confirm skill plan <ArrowRight className="size-4" />
          </Button>
        )}
        {step === 4 && (
          <Button
            disabled={busy}
            onClick={() => void generate()}
            className="bg-[#5b5de4]"
          >
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}{' '}
            Generate resume
          </Button>
        )}
        {step === 5 && (
          <Button
            variant="outline"
            onClick={() => {
              setJobId(null);
              setStep(1);
            }}
          >
            <Plus className="size-4" /> Start another
          </Button>
        )}
      </div>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="corporate-dialog corporate-dialog--medium overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit resume content</DialogTitle>
            <DialogDescription>
              Edit every section. Saving creates a new immutable version; an
              approved version is never overwritten.
            </DialogDescription>
          </DialogHeader>
          {editContent && (
            <div className="grid gap-4">
              <label className="space-y-1">
                <span className="text-xs font-semibold">Headline</span>
                <input
                  value={editContent.headline}
                  onChange={(event) =>
                    setEditContent({
                      ...editContent,
                      headline: event.target.value,
                    })
                  }
                  className="h-11 w-full rounded-xl border px-3"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">
                  Professional summary
                </span>
                <textarea
                  value={editContent.summary}
                  onChange={(event) =>
                    setEditContent({
                      ...editContent,
                      summary: event.target.value,
                    })
                  }
                  className="min-h-32 w-full rounded-xl border px-3 py-2"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">
                  Skills (comma separated)
                </span>
                <textarea
                  value={editContent.skills.join(', ')}
                  onChange={(event) =>
                    setEditContent({
                      ...editContent,
                      skills: event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                  className="min-h-20 w-full rounded-xl border px-3 py-2"
                />
              </label>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold">Experience</p>
                  <p className="mt-1 text-[10px] text-[#8c95a5]">
                    Add, remove, and edit complete roles and bullets.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setEditContent({
                      ...editContent,
                      experience: [
                        ...editContent.experience,
                        {
                          title: '',
                          company: '',
                          location: '',
                          dates: '',
                          bullets: [],
                        },
                      ],
                    })
                  }
                  className="h-8 text-[10px]"
                >
                  <Plus className="size-3" /> Add role
                </Button>
              </div>
              {editContent.experience.map((role, index) => (
                <div key={index} className="rounded-xl border p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ['title', 'Title'],
                        ['company', 'Company'],
                        ['location', 'Location'],
                        ['dates', 'Dates'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="space-y-1">
                        <span className="text-[10px] font-semibold">
                          {label}
                        </span>
                        <input
                          value={role[key]}
                          onChange={(event) => {
                            const experience = [...editContent.experience];
                            experience[index] = {
                              ...role,
                              [key]: event.target.value,
                            };
                            setEditContent({ ...editContent, experience });
                          }}
                          className="h-9 w-full rounded-lg border px-2.5 text-xs"
                        />
                      </label>
                    ))}
                  </div>
                  <label className="mt-3 block space-y-1">
                    <span className="text-[10px] font-semibold">
                      Bullets — one per line
                    </span>
                    <textarea
                      value={role.bullets.join('\n')}
                      onChange={(event) => {
                        const experience = [...editContent.experience];
                        experience[index] = {
                          ...role,
                          bullets: event.target.value
                            .split('\n')
                            .map((item) => item.trim())
                            .filter(Boolean),
                        };
                        setEditContent({ ...editContent, experience });
                      }}
                      className="min-h-28 w-full rounded-lg border px-3 py-2 text-xs"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setEditContent({
                        ...editContent,
                        experience: editContent.experience.filter(
                          (_, roleIndex) => roleIndex !== index,
                        ),
                      })
                    }
                    className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-[#a04b58]"
                  >
                    <Trash2 className="size-3" /> Remove role
                  </button>
                </div>
              ))}
              <label className="space-y-1">
                <span className="text-xs font-semibold">
                  Education — one entry per line
                </span>
                <textarea
                  value={editContent.education.join('\n')}
                  onChange={(event) =>
                    setEditContent({
                      ...editContent,
                      education: event.target.value
                        .split('\n')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                  className="min-h-24 w-full rounded-xl border px-3 py-2 text-xs"
                />
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              disabled={!editContent?.headline || !editContent?.summary}
              onClick={() => void saveEdit()}
              className="bg-[#5b5de4]"
            >
              Save new version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TargetCard() {
  return (
    <>
      <div className="flex size-10 items-center justify-center rounded-xl bg-[#e7e8ff] text-[#5c5ed0]">
        <BriefcaseBusiness className="size-5" />
      </div>
      <h3 className="mt-5 text-sm font-semibold">JD-first by design</h3>
      <p className="mt-2 text-xs leading-5 text-[#707a8c]">
        We analyze the full description before considering profile evidence.
      </p>
      <div className="mt-5 space-y-3">
        {[
          'Detect family and role',
          'Separate mandatory and preferred skills',
          'Resolve every requirement source',
          'Generate a brand-new job version',
        ].map((item) => (
          <div
            key={item}
            className="flex items-start gap-2.5 text-xs text-[#545e71]"
          >
            <CheckCircle2 className="mt-0.5 size-4 flex-none text-[#4da17f]" />
            {item}
          </div>
        ))}
      </div>
    </>
  );
}

function ResumeHistoryPage({
  openStudio,
}: {
  openStudio: (step?: number, jobId?: string) => void;
}) {
  const { state } = usePlatform();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  if (!state) return null;
  const rows = state.resumes.filter((resume) => {
    const job = state.jobs.find((item) => item.id === resume.jobId);
    const candidate = state.candidates.find(
      (item) => item.id === resume.candidateId,
    );
    return (
      `${job?.title} ${job?.company} ${candidate?.name}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === 'All' || resume.status === filter)
    );
  });
  const exportLog = () =>
    downloadCsv('resume-history.csv', [
      [
        'Candidate',
        'Company',
        'Target',
        'Version',
        'Match',
        'Status',
        'Created',
      ],
      ...rows.map((resume) => {
        const job = state.jobs.find((item) => item.id === resume.jobId);
        const candidate = state.candidates.find(
          (item) => item.id === resume.candidateId,
        );
        return [
          candidate?.name ?? '',
          job?.company ?? '',
          job?.title ?? '',
          resume.version,
          resume.scores.jdMatch,
          resume.status,
          resume.createdAt,
        ];
      }),
    ]);
  return (
    <>
      <PageHeading
        title="Resume history"
        description="Every generated version, edit, score, engine, and approval decision."
        actions={
          <Button
            variant="outline"
            onClick={exportLog}
            className="h-10 text-xs"
          >
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />
      <div className="rounded-2xl border border-[#e6e9ef] bg-white">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:justify-between">
          <label className="flex h-10 max-w-sm flex-1 items-center gap-2 rounded-xl border bg-[#f8f9fb] px-3 text-xs">
            <Search className="size-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search history"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="h-10 rounded-xl border bg-white px-3 text-xs"
          >
            <option>All</option>
            <option>Ready for review</option>
            <option>Approved</option>
            <option>Superseded</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead>
              <tr className="border-b bg-[#fafbfc] text-[10px] uppercase tracking-[.08em] text-[#929aaa]">
                <th className="px-6 py-3.5">Candidate & target</th>
                <th className="px-4 py-3.5">Company</th>
                <th className="px-4 py-3.5">Version</th>
                <th className="px-4 py-3.5">Engine</th>
                <th className="px-4 py-3.5">Match</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((resume) => {
                const job = state.jobs.find((item) => item.id === resume.jobId);
                const candidate = state.candidates.find(
                  (item) => item.id === resume.candidateId,
                );
                return (
                  <tr
                    key={resume.id}
                    onClick={() => openStudio(5, resume.jobId)}
                    className="cursor-pointer border-b hover:bg-[#fafbff]"
                  >
                    <td className="px-6 py-4">
                      <p className="text-[13px] font-semibold">{job?.title}</p>
                      <p className="text-[11px] text-[#929aaa]">
                        {candidate?.name}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-xs">{job?.company}</td>
                    <td className="px-4 py-4 text-xs font-bold">
                      v{resume.version}
                    </td>
                    <td className="px-4 py-4 text-[10px] text-[#697386]">
                      {resume.engine}
                    </td>
                    <td className="px-4 py-4 text-xs font-bold">
                      {resume.scores.jdMatch}%
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill status={resume.status} />
                    </td>
                    <td className="px-6 py-4 text-right text-[10px] text-[#929aaa]">
                      {formatDate(resume.createdAt, true)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && (
            <Empty
              icon={FileClock}
              title="No versions found"
              detail="Try another filter or generate a resume."
            />
          )}
        </div>
      </div>
    </>
  );
}

function FamilyDialog({
  family,
  open,
  setOpen,
  notify,
}: {
  family: JobFamily | null;
  open: boolean;
  setOpen: (value: boolean) => void;
  notify: AdminPortalProps['notify'];
}) {
  const { act, busy } = usePlatform();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [roles, setRoles] = useState('');
  const [skills, setSkills] = useState('');
  useEffect(() => {
    setName(family?.name ?? '');
    setDescription(family?.description ?? '');
    setRoles(family?.roles.join(', ') ?? '');
    setSkills(family?.skills.join(', ') ?? '');
  }, [family, open]);
  const save = async () => {
    try {
      const result = await act('family.save', {
        id: family?.id,
        name,
        description,
        roles,
        skills,
        active: true,
      });
      notify(result.message ?? 'Family saved.');
      setOpen(false);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not save family.',
        'error',
      );
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="corporate-dialog corporate-dialog--small">
        <DialogHeader>
          <DialogTitle>
            {family ? 'Edit job family' : 'Create job family'}
          </DialogTitle>
          <DialogDescription>
            Define the role boundary and approved skills used by the enrichment
            engine.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <label className="space-y-1">
            <span className="text-xs font-semibold">Family name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-xl border px-3"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-20 w-full rounded-xl border px-3 py-2"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold">Related roles</span>
            <textarea
              value={roles}
              onChange={(e) => setRoles(e.target.value)}
              className="min-h-20 w-full rounded-xl border px-3 py-2"
              placeholder="comma separated"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold">
              Approved family skills
            </span>
            <textarea
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="min-h-28 w-full rounded-xl border px-3 py-2"
              placeholder="comma separated"
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={busy || !name}
            onClick={() => void save()}
            className="bg-[#5b5de4]"
          >
            Save family
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PromptDialog({
  prompt,
  open,
  setOpen,
  notify,
}: {
  prompt: Prompt | null;
  open: boolean;
  setOpen: (value: boolean) => void;
  notify: AdminPortalProps['notify'];
}) {
  const { act, busy } = usePlatform();
  const [name, setName] = useState('');
  const [scope, setScope] = useState('Global');
  const [template, setTemplate] = useState('');
  useEffect(() => {
    setName(prompt?.name ?? '');
    setScope(prompt?.scope ?? 'Global');
    setTemplate(prompt?.template ?? '');
  }, [prompt, open]);
  const save = async () => {
    try {
      const result = await act('prompt.save', {
        id: prompt?.id,
        name,
        scope,
        template,
        active: true,
      });
      notify(result.message ?? 'Prompt saved.');
      setOpen(false);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not save prompt.',
        'error',
      );
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="corporate-dialog corporate-dialog--medium">
        <DialogHeader>
          <DialogTitle>{prompt ? 'Edit prompt' : 'Create prompt'}</DialogTitle>
          <DialogDescription>
            Each save creates a numbered version used by future generation
            requests.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-xl border px-3"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold">Scope</span>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="h-11 w-full rounded-xl border bg-white px-3"
            >
              <option>Global</option>
              <option>Job family</option>
              <option>Candidate</option>
            </select>
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold">Prompt instructions</span>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="min-h-64 w-full rounded-xl border px-3 py-3 font-mono text-xs leading-5"
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={busy || !name || !template}
            onClick={() => void save()}
            className="bg-[#5b5de4]"
          >
            Save prompt version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IntelligencePage({ notify }: { notify: AdminPortalProps['notify'] }) {
  const { state, act } = usePlatform();
  const [familyOpen, setFamilyOpen] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<JobFamily | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  useEffect(() => {
    if (state) setDraft(structuredClone(state.settings));
  }, [state?.settings]);
  if (!state || !draft) return null;
  const saveSettings = async () => {
    try {
      const result = await act('settings.update', { settings: draft });
      notify(result.message ?? 'Rules saved.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not save rules.',
        'error',
      );
    }
  };
  const deleteFamily = async (family: JobFamily) => {
    if (!window.confirm(`Delete ${family.name}?`)) return;
    try {
      const result = await act('family.delete', { id: family.id });
      notify(result.message ?? 'Family deleted.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not delete family.',
        'error',
      );
    }
  };
  const runEval = async () => {
    try {
      const result = await act('evaluation.run');
      notify(result.message ?? 'Evaluation completed.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Evaluation failed.',
        'error',
      );
    }
  };
  return (
    <>
      <PageHeading
        title="Intelligence"
        description="Manage taxonomy, global skills and locations, templates, prompts, enrichment rules, and recruiter-safe policy."
        actions={
          <Button
            onClick={() => void runEval()}
            className="h-10 bg-[#5b5de4] text-xs"
          >
            <Activity className="size-4" /> Run evaluations
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold">Job-family taxonomy</h2>
              <p className="mt-1 text-xs text-[#8c95a5]">
                Approved roles and skill boundaries
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedFamily(null);
                setFamilyOpen(true);
              }}
              className="flex size-9 items-center justify-center rounded-xl border"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {state.families.map((family) => (
              <div key={family.id} className="rounded-xl border p-4">
                <div className="flex items-center gap-3">
                  <span className="size-2.5 rounded-full bg-[#5b5de4]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">{family.name}</p>
                    <p className="mt-1 truncate text-[10px] text-[#929aaa]">
                      {family.description}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFamily(family);
                      setFamilyOpen(true);
                    }}
                    className="rounded-lg border p-2"
                  >
                    <PencilLine className="size-3" />
                  </button>
                  <button
                    onClick={() => void deleteFamily(family)}
                    className="rounded-lg p-2 text-[#a04b58]"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
                <div className="mt-3 flex gap-5 text-[10px] text-[#929aaa]">
                  <span>
                    <b className="text-[#4a5366]">{family.roles.length}</b>{' '}
                    roles
                  </span>
                  <span>
                    <b className="text-[#4a5366]">{family.skills.length}</b>{' '}
                    skills
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold">Prompt studio</h2>
              <p className="mt-1 text-xs text-[#8c95a5]">
                Versioned custom prompt layers
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedPrompt(null);
                setPromptOpen(true);
              }}
              className="flex size-9 items-center justify-center rounded-xl border"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {state.prompts.map((prompt) => (
              <button
                key={prompt.id}
                onClick={() => {
                  setSelectedPrompt(prompt);
                  setPromptOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-xl border p-4 text-left hover:bg-[#fafbff]"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-[#f0f1ff] text-[#5b5dd0]">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">
                    {prompt.name}
                  </p>
                  <p className="mt-1 text-[10px] text-[#929aaa]">
                    {prompt.scope} · v{prompt.version}
                  </p>
                </div>
                <ArrowRight className="size-3.5 text-[#a2a9b6]" />
              </button>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">
                Enrichment & recruiter-safe rules
              </h2>
              <p className="mt-1 text-xs text-[#8c95a5]">
                Evidence-safe generation boundaries
              </p>
            </div>
            <Button
              onClick={() => void saveSettings()}
              variant="outline"
              className="h-9 text-[10px]"
            >
              <Check className="size-3" /> Save rules
            </Button>
          </div>
          <div className="mt-5 space-y-3">
            <ToggleRow
              label="Approved family match"
              detail="Allow JD skills inside the candidate’s approved family."
              checked={draft.guardrails.familyMatch}
              setChecked={(value) =>
                setDraft({
                  ...draft,
                  guardrails: { ...draft.guardrails, familyMatch: value },
                })
              }
            />
            <ToggleRow
              label="Supporting context"
              detail="Include preferred context without claiming experience."
              checked={draft.guardrails.supportingContext}
              setChecked={(value) =>
                setDraft({
                  ...draft,
                  guardrails: { ...draft.guardrails, supportingContext: value },
                })
              }
            />
            <label className="block rounded-xl border p-4">
              <span className="text-xs font-semibold">
                Strongly related roles
              </span>
              <select
                value={draft.guardrails.relatedRoles}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    guardrails: {
                      ...draft.guardrails,
                      relatedRoles: e.target.value as
                        | 'allow'
                        | 'review'
                        | 'block',
                    },
                  })
                }
                className="mt-3 h-9 w-full rounded-lg border bg-white px-2 text-xs"
              >
                <option value="allow">Allow</option>
                <option value="review">Require review</option>
                <option value="block">Block</option>
              </select>
            </label>
            <div className="rounded-xl border border-[#f0dadd] bg-[#fff8f8] p-4">
              <div className="flex items-center gap-2 text-[#aa4958]">
                <LockKeyhole className="size-4" />
                <p className="text-xs font-semibold">
                  Unrelated skills: always blocked
                </p>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-[#81666a]">
                This hard safety rule cannot be weakened from the UI.
              </p>
            </div>
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-base font-semibold">
            Templates & target locations
          </h2>
          <p className="mt-1 text-xs text-[#8c95a5]">
            Reusable choices offered in Resume Studio
          </p>
          <label className="mt-5 block space-y-1">
            <span className="text-xs font-semibold">
              Resume templates (one per line)
            </span>
            <textarea
              value={draft.templates.join('\n')}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  templates: e.target.value
                    .split('\n')
                    .map((v) => v.trim())
                    .filter(Boolean),
                })
              }
              className="min-h-28 w-full rounded-xl border px-3 py-2 text-xs"
            />
          </label>
          <label className="mt-4 block space-y-1">
            <span className="text-xs font-semibold">
              Approved locations (one per line)
            </span>
            <textarea
              value={draft.locations.join('\n')}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  locations: e.target.value
                    .split('\n')
                    .map((v) => v.trim())
                    .filter(Boolean),
                })
              }
              className="min-h-28 w-full rounded-xl border px-3 py-2 text-xs"
            />
          </label>
          <Button
            onClick={() => void saveSettings()}
            className="mt-4 bg-[#5b5de4] text-xs"
          >
            Save reusable options
          </Button>
        </section>
      </div>
      <FamilyDialog
        family={selectedFamily}
        open={familyOpen}
        setOpen={setFamilyOpen}
        notify={notify}
      />
      <PromptDialog
        prompt={selectedPrompt}
        open={promptOpen}
        setOpen={setPromptOpen}
        notify={notify}
      />
    </>
  );
}

function ToggleRow({
  label,
  detail,
  checked,
  setChecked,
}: {
  label: string;
  detail: string;
  checked: boolean;
  setChecked: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
      <div>
        <p className="text-xs font-semibold">{label}</p>
        <p className="mt-1 text-[10px] text-[#8a93a4]">{detail}</p>
      </div>
      <button
        onClick={() => setChecked(!checked)}
        role="switch"
        aria-checked={checked}
        className={`relative h-6 w-11 flex-none rounded-full ${checked ? 'bg-[#5b5de4]' : 'bg-[#dfe3ea]'}`}
      >
        <span
          className={`absolute top-1 size-4 rounded-full bg-white shadow-sm ${checked ? 'right-1' : 'left-1'}`}
        />
      </button>
    </div>
  );
}

function PlatformPage({ notify }: { notify: AdminPortalProps['notify'] }) {
  const {
    state,
    act,
    upload,
    connectOpenAI,
    disconnectOpenAI,
    busy,
    fetchFileUrl,
  } = usePlatform();
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const [apiOpen, setApiOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state) setDraft(structuredClone(state.settings));
  }, [state?.settings]);
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
  if (!state || !draft) return null;
  const save = async () => {
    try {
      const result = await act('settings.update', { settings: draft });
      notify(result.message ?? 'Settings saved.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not save settings.',
        'error',
      );
    }
  };
  const logo = async (file: File) => {
    try {
      const form = new FormData();
      form.set('purpose', 'logo');
      form.set('file', file);
      const result = await upload(form);
      notify(result.message ?? 'Logo uploaded.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not upload logo.',
        'error',
      );
    }
  };
  const connect = async () => {
    try {
      const result = await connectOpenAI(apiKey);
      setApiKey('');
      setApiOpen(false);
      notify(result.message ?? 'OpenAI connected.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not connect OpenAI.',
        'error',
      );
    }
  };
  const disconnect = async () => {
    if (
      !window.confirm(
        'Disconnect OpenAI? Resume generation will continue using the safe deterministic fallback.',
      )
    )
      return;
    try {
      const result = await disconnectOpenAI();
      notify(result.message ?? 'OpenAI disconnected.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not disconnect OpenAI.',
        'error',
      );
    }
  };
  const publishAnnouncement = async () => {
    try {
      const result = await act('announcement.save', {
        title: announcementTitle,
        message: announcementMessage,
        active: true,
      });
      setAnnouncementTitle('');
      setAnnouncementMessage('');
      notify(result.message ?? 'Announcement published.');
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'Could not publish announcement.',
        'error',
      );
    }
  };
  const deleteAnnouncement = async (id: string) => {
    try {
      const result = await act('announcement.delete', { id });
      notify(result.message ?? 'Announcement deleted.');
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'Could not delete announcement.',
        'error',
      );
    }
  };
  return (
    <>
      <PageHeading
        title="Platform settings"
        description="Branding, appearance, navigation, dashboard widgets, notifications, system settings, announcements, and AI connection."
        actions={
          <Button
            disabled={busy}
            onClick={() => void save()}
            className="h-10 bg-[#5b5de4] text-xs"
          >
            <Check className="size-4" /> Save & publish
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_430px]">
        <div className="space-y-5">
          <section className="rounded-2xl border bg-white p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#eff0ff] text-[#5b5dd0]">
                <Palette className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Brand appearance</h2>
                <p className="text-[11px] text-[#8c95a5]">
                  Website logo, color, font, and portal name
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold">Website logo</p>
                <button
                  onClick={() => logoRef.current?.click()}
                  className="flex h-24 w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed bg-[#fafbfc] text-[#7d8697]"
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Current website logo"
                      className="max-h-16 max-w-[80%] object-contain"
                    />
                  ) : (
                    <>
                      <UploadCloud className="size-5" />
                      <span className="mt-2 text-[10px]">
                        Upload PNG, JPG, or WEBP
                      </span>
                    </>
                  )}
                </button>
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void logo(file);
                  }}
                  className="hidden"
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold">Primary color</p>
                <div className="flex h-24 items-center gap-3 rounded-xl border p-4">
                  {['#5B5DE4', '#267D67', '#2668A8', '#A05B46'].map((color) => (
                    <button
                      key={color}
                      onClick={() =>
                        setDraft({ ...draft, primaryColor: color })
                      }
                      aria-label={`Use ${color}`}
                      className={`size-9 rounded-full border-4 border-white shadow-[0_0_0_1px_#dfe3ea] ${draft.primaryColor === color ? 'ring-2 ring-offset-2' : ''}`}
                      style={{
                        backgroundColor: color,
                        ['--tw-ring-color' as string]: color,
                      }}
                    />
                  ))}
                </div>
              </div>
              <label className="space-y-1">
                <span className="text-xs font-semibold">Font family</span>
                <select
                  value={draft.fontFamily}
                  onChange={(e) =>
                    setDraft({ ...draft, fontFamily: e.target.value })
                  }
                  className="h-11 w-full rounded-xl border bg-white px-3"
                >
                  <option>Geist Sans</option>
                  <option>Inter</option>
                  <option>Source Sans 3</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">Portal name</span>
                <input
                  value={draft.portalName}
                  onChange={(e) =>
                    setDraft({ ...draft, portalName: e.target.value })
                  }
                  className="h-11 w-full rounded-xl border px-3"
                />
              </label>
            </div>
          </section>
          <section className="rounded-2xl border bg-white p-6">
            <h2 className="text-sm font-semibold">Candidate portal controls</h2>
            <p className="mt-1 text-[11px] text-[#8c95a5]">
              Every enabled area remains strictly read only.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {Object.entries(draft.visibility).map(([key, value]) => (
                <ToggleRow
                  key={key}
                  label={
                    (
                      {
                        fullJd: 'Complete job descriptions',
                        skillProvenance: 'Skill provenance',
                        resumeDownloads: 'Resume downloads',
                        salary: 'Salary when available',
                      } as Record<string, string>
                    )[key]
                  }
                  detail="Visibility only; never grants edit access."
                  checked={value}
                  setChecked={(checked) =>
                    setDraft({
                      ...draft,
                      visibility: { ...draft.visibility, [key]: checked },
                    })
                  }
                />
              ))}
              {Object.entries(draft.navigation).map(([key, value]) => (
                <ToggleRow
                  key={key}
                  label={`${key[0].toUpperCase() + key.slice(1)} navigation`}
                  detail="Show this portal destination."
                  checked={value}
                  setChecked={(checked) =>
                    setDraft({
                      ...draft,
                      navigation: { ...draft.navigation, [key]: checked },
                    })
                  }
                />
              ))}
              {Object.entries(draft.widgets).map(([key, value]) => (
                <ToggleRow
                  key={key}
                  label={`${key.replace(/([A-Z])/g, ' $1')} widget`}
                  detail="Show on the candidate dashboard."
                  checked={value}
                  setChecked={(checked) =>
                    setDraft({
                      ...draft,
                      widgets: { ...draft.widgets, [key]: checked },
                    })
                  }
                />
              ))}
            </div>
          </section>
          <section className="rounded-2xl border bg-white p-6">
            <h2 className="text-sm font-semibold">Notification messages</h2>
            <p className="mt-1 text-[11px] text-[#8c95a5]">
              Candidate-facing copy for key portal moments
            </p>
            <div className="mt-5 space-y-4">
              {Object.entries(draft.notifications).map(([key, value]) => (
                <label key={key} className="block space-y-1">
                  <span className="text-xs font-semibold capitalize">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <textarea
                    value={value}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        notifications: {
                          ...draft.notifications,
                          [key]: e.target.value,
                        },
                      })
                    }
                    className="min-h-20 w-full rounded-xl border px-3 py-2 text-xs"
                  />
                </label>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border bg-white p-6">
            <h2 className="text-sm font-semibold">System settings</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs font-semibold">Timezone</span>
                <input
                  value={draft.system.timezone}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      system: { ...draft.system, timezone: e.target.value },
                    })
                  }
                  className="h-11 w-full rounded-xl border px-3 text-xs"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">Date format</span>
                <input
                  value={draft.system.dateFormat}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      system: { ...draft.system, dateFormat: e.target.value },
                    })
                  }
                  className="h-11 w-full rounded-xl border px-3 text-xs"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">OpenAI model</span>
                <input
                  value={draft.system.openAIModel}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      system: { ...draft.system, openAIModel: e.target.value },
                    })
                  }
                  className="h-11 w-full rounded-xl border px-3 text-xs"
                />
              </label>
            </div>
          </section>
          <section className="rounded-2xl border bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Announcements</h2>
                <p className="mt-1 text-[11px] text-[#8c95a5]">
                  Publish messages to candidate dashboards
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1.6fr_auto]">
              <input
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                placeholder="Title"
                className="h-10 rounded-xl border px-3 text-xs"
              />
              <input
                value={announcementMessage}
                onChange={(e) => setAnnouncementMessage(e.target.value)}
                placeholder="Message"
                className="h-10 rounded-xl border px-3 text-xs"
              />
              <Button
                disabled={!announcementTitle || !announcementMessage}
                onClick={() => void publishAnnouncement()}
                className="h-10 bg-[#5b5de4] text-xs"
              >
                Publish
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {state.announcements.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border p-3"
                >
                  <Bell className="mt-0.5 size-4 text-[#5b5de4]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">{item.title}</p>
                    <p className="mt-1 text-[10px] text-[#7b8496]">
                      {item.message}
                    </p>
                  </div>
                  <button
                    onClick={() => void deleteAnnouncement(item.id)}
                    className="p-1 text-[#a04b58]"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="space-y-5 xl:sticky xl:top-[96px] xl:self-start">
          <section className="rounded-2xl border bg-white p-5">
            <div className="flex items-center gap-3">
              <div
                className={`flex size-10 items-center justify-center rounded-xl ${state.credential.connected ? 'bg-[#eaf8f2] text-[#267b60]' : 'bg-[#fff4e6] text-[#ad691e]'}`}
              >
                <KeyRound className="size-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold">OpenAI connection</h2>
                <p className="mt-1 text-[10px] text-[#8c95a5]">
                  {state.credential.connected
                    ? `Connected · ending ${state.credential.lastFour}`
                    : 'Not connected · safe fallback active'}
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              {state.credential.connected ? (
                <>
                  <Button
                    onClick={() => setApiOpen(true)}
                    variant="outline"
                    className="flex-1 text-xs"
                  >
                    Replace key
                  </Button>
                  <Button
                    onClick={() => void disconnect()}
                    variant="outline"
                    className="text-xs text-[#a04b58]"
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setApiOpen(true)}
                  className="w-full bg-[#5b5de4] text-xs"
                >
                  <KeyRound className="size-4" /> Connect OpenAI
                </Button>
              )}
            </div>
            <div className="mt-4 rounded-xl bg-[#f7f8fa] p-3 text-[10px] leading-4 text-[#697386]">
              <LockKeyhole className="mb-2 size-4 text-[#5b5de4]" />
              On Firebase’s free plan, the key is stored only in this
              administrator browser. It is never written to Firestore or exposed
              to candidates.
            </div>
          </section>
          <section
            className="overflow-hidden rounded-[24px] border bg-[#f5f7fb] shadow-[0_18px_45px_rgba(31,40,59,.1)]"
            style={portalThemeStyle(draft)}
          >
            <div className="flex items-center justify-between border-b bg-white px-5 py-4">
              <div className="flex items-center gap-2">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Portal logo preview"
                    className="size-7 object-contain"
                  />
                ) : (
                  <div
                    className="flex size-7 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: draft.primaryColor }}
                  >
                    <Sparkles className="size-3.5" />
                  </div>
                )}
                <span className="text-xs font-semibold">
                  {draft.portalName}
                </span>
              </div>
              <span className="rounded-full bg-[#eef0f4] px-2 py-1 text-[8px] font-semibold">
                READ ONLY
              </span>
            </div>
            <div className="p-6">
              <p
                className="text-[10px] font-semibold"
                style={{ color: draft.primaryColor }}
              >
                WELCOME BACK
              </p>
              <h3 className="mt-1 text-xl font-semibold">Hello, John</h3>
              <p className="mt-1 text-[10px] text-[#8992a3]">
                {draft.notifications.welcome}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {[
                  [
                    'Applied',
                    state.jobs.filter((j) => j.status === 'Applied').length,
                  ],
                  [
                    'Pending',
                    state.jobs.filter((j) => j.status === 'Pending').length,
                  ],
                  [
                    'Interviews',
                    state.jobs.filter((j) => j.status === 'Interview').length,
                  ],
                  [
                    'Offers',
                    state.jobs.filter((j) => j.status === 'Offer').length,
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border bg-white p-3">
                    <p className="text-lg font-bold">{value}</p>
                    <p className="text-[8px] text-[#8992a3]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </aside>
      </div>
      <Dialog open={apiOpen} onOpenChange={setApiOpen}>
        <DialogContent className="corporate-dialog corporate-dialog--small">
          <DialogHeader>
            <DialogTitle>Connect OpenAI on this browser</DialogTitle>
            <DialogDescription>
              The key stays in this administrator browser and is sent directly
              to OpenAI only when you generate a resume.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-1">
            <span className="text-xs font-semibold">OpenAI API key</span>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-proj-…"
              className="h-11 w-full rounded-xl border px-3 font-mono text-xs"
            />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApiOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !apiKey}
              onClick={() => void connect()}
              className="bg-[#5b5de4]"
            >
              {busy && <LoaderCircle className="size-4 animate-spin" />}{' '}
              Validate & connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OperationsPage({ notify }: { notify: AdminPortalProps['notify'] }) {
  const { state, act, busy } = usePlatform();
  if (!state) return null;
  const health = evaluateReleaseHealth(state);
  const runReleaseGate = async () => {
    try {
      const result = await act('evaluation.run');
      notify(result.message ?? 'Release checks completed.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Release checks failed.',
        'error',
      );
    }
  };
  const statuses = [
    'Selected',
    'Pending',
    'Applied',
    'Interview',
    'Rejected',
    'Offer',
    'Failed',
  ];
  const summary = [
    { label: 'Candidates', value: state.candidates.length, Icon: UsersRound },
    {
      label: 'Jobs tracked',
      value: state.jobs.length,
      Icon: BriefcaseBusiness,
    },
    { label: 'Resume versions', value: state.resumes.length, Icon: FileText },
  ];
  const exportLogs = () =>
    downloadCsv('resumeos-audit-log.csv', [
      ['Time', 'Actor', 'Action', 'Entity', 'ID'],
      ...state.logs.map((log) => [
        log.createdAt,
        log.actorEmail,
        log.action,
        log.entityType,
        log.entityId,
      ]),
    ]);
  return (
    <>
      <PageHeading
        title="Website health & operations"
        description="Release readiness, functional coverage, data integrity, analytics, evaluations, and the complete audit trail."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={exportLogs}
              className="h-10 text-xs"
            >
              <Download className="size-4" /> Export audit log
            </Button>
            <Button
              disabled={busy}
              onClick={() => void runReleaseGate()}
              className="portal-accent-bg h-10 text-xs"
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}{' '}
              Run release checks
            </Button>
          </div>
        }
      />
      <section
        className={`mb-5 overflow-hidden rounded-2xl border bg-white ${health.ready ? 'border-[#cfe9df]' : 'border-[#f0d9bd]'}`}
      >
        <div
          className={`flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between ${health.ready ? 'bg-[#f4fbf8]' : 'bg-[#fff9f1]'}`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`flex size-11 items-center justify-center rounded-2xl ${health.ready ? 'bg-[#dff5eb] text-[#197256]' : 'bg-[#fff0d9] text-[#a36319]'}`}
            >
              {health.ready ? (
                <CheckCircle2 className="size-5" />
              ) : (
                <CircleAlert className="size-5" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#7b8496]">
                Production release status
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                {health.ready
                  ? 'All release checks passed'
                  : 'Release is blocked'}
              </h2>
              <p className="mt-1 text-[11px] text-[#7b8496]">
                {health.passed} of {health.total} checks passing ·{' '}
                {health.score}% readiness
              </p>
            </div>
          </div>
          <span
            className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-bold ${health.ready ? 'bg-[#dff5eb] text-[#197256]' : 'bg-[#fff0d9] text-[#a36319]'}`}
          >
            {health.ready ? 'PRODUCTION HEALTHY' : 'DO NOT RELEASE'}
          </span>
        </div>
        <div className="grid gap-px bg-[#edf0f4] sm:grid-cols-2 xl:grid-cols-5">
          {health.checks.map((check) => (
            <div key={check.id} className="bg-white p-4">
              <div className="flex items-start gap-2.5">
                {check.ready ? (
                  <CheckCircle2 className="mt-0.5 size-4 flex-none text-[#278364]" />
                ) : (
                  <CircleAlert className="mt-0.5 size-4 flex-none text-[#b26b1e]" />
                )}
                <div>
                  <p className="text-[11px] font-semibold">{check.label}</p>
                  <p className="mt-1 text-[9px] leading-4 text-[#8790a1]">
                    {check.detail}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-3">
        {summary.map(({ label, value, Icon }) => (
          <div key={label} className="rounded-2xl border bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#7b8496]">{label}</p>
              <Icon className="size-4 text-[#5b5de4]" />
            </div>
            <p className="mt-4 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[.85fr_1.35fr]">
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-sm font-semibold">Application funnel</h2>
          <div className="mt-5 space-y-4">
            {statuses.map((status) => {
              const count = state.jobs.filter(
                (job) => job.status === status,
              ).length;
              const width = state.jobs.length
                ? Math.max(4, Math.round((count / state.jobs.length) * 100))
                : 0;
              return (
                <div key={status}>
                  <div className="mb-1.5 flex justify-between text-[10px]">
                    <span>{status}</span>
                    <b>{count}</b>
                  </div>
                  <div className="h-2 rounded-full bg-[#edf0f4]">
                    <div
                      className="h-full rounded-full bg-[#5b5de4]"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <h2 className="mt-8 text-sm font-semibold">Evaluation history</h2>
          <div className="mt-4 space-y-2">
            {state.evaluations.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border p-3"
              >
                <div className="flex size-8 items-center justify-center rounded-full bg-[#eaf8f2] text-[#267b60]">
                  <Check className="size-4" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold">{item.name}</p>
                  <p className="text-[9px] text-[#929aaa]">
                    {formatDate(item.createdAt, true)}
                  </p>
                </div>
                <span className="text-sm font-bold">{item.score}%</span>
              </div>
            ))}
          </div>
        </section>
        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="border-b px-5 py-5">
            <h2 className="text-sm font-semibold">
              Generation & application audit log
            </h2>
            <p className="mt-1 text-[10px] text-[#8c95a5]">
              Append-only history of every administrative write
            </p>
          </div>
          <div className="max-h-[650px] overflow-y-auto divide-y">
            {state.logs.map((log) => (
              <div
                key={log.id}
                className="grid gap-2 px-5 py-4 sm:grid-cols-[150px_1fr_150px]"
              >
                <p className="text-[10px] text-[#929aaa]">
                  {formatDate(log.createdAt, true)}
                </p>
                <div>
                  <p className="text-[11px] font-semibold">
                    {log.action.replaceAll('.', ' · ')}
                  </p>
                  <p className="mt-1 text-[9px] text-[#929aaa]">
                    {log.actorEmail}
                  </p>
                </div>
                <p className="text-[10px] text-[#697386] sm:text-right">
                  {log.entityType} · {log.entityId.slice(0, 12)}
                </p>
              </div>
            ))}
            {!state.logs.length && (
              <Empty
                icon={Activity}
                title="No audit records"
                detail="Writes will appear here automatically."
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}

export function AdminPortal({
  activePage,
  setActivePage,
  studioStep,
  setStudioStep,
  studioJobId,
  setStudioJobId,
  previewCandidate,
  notify,
}: AdminPortalProps) {
  const { state, busy } = usePlatform();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const openStudio = (step = 1, jobId?: string) => {
    setStudioJobId(jobId ?? null);
    setStudioStep(step);
    setActivePage('Resume studio');
  };
  const openMatching = () => setActivePage('Job matching');
  const content = () => {
    switch (activePage) {
      case 'Job matching':
        return <JobMatching notify={notify} openStudio={openStudio} />;
      case 'Gmail':
        return <GmailPanel admin />;
      case 'Candidates':
        return (
          <CandidatesPage previewCandidate={previewCandidate} openStudio={openStudio} notify={notify} />
        );
      case 'Onboarding':
        return <OnboardingPage notify={notify} />;
      case 'Jobs & JDs':
        return <JobsPage openStudio={openStudio} openMatching={openMatching} notify={notify} />;
      case 'Resume studio':
        return <ResumeWorkspace initialJobId={studioJobId} onJobChange={setStudioJobId} notify={notify} />;
      case 'Resume history':
        return <ResumeHistoryPage openStudio={openStudio} />;
      case 'Intelligence':
        return <IntelligencePage notify={notify} />;
      case 'Platform':
        return <PlatformPage notify={notify} />;
      case 'Operations':
        return <OperationsPage notify={notify} />;
      default:
        return (
          <AdminOverview
            openStudio={openStudio}
            openHistory={() => setActivePage('Resume studio')}
          />
        );
    }
  };
  if (!state) return null;
  return (
    <main
      className="portal-theme min-h-screen bg-[#f3f5f8] text-[#182033]"
      style={portalThemeStyle(state.settings)}
    >
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] border-r border-[#243146] lg:block">
        <Sidebar activePage={activePage} setActivePage={setActivePage} />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-[#111827]/45 backdrop-blur-sm"
          />
          <aside className="relative h-full w-[280px]">
            <Sidebar
              activePage={activePage}
              setActivePage={setActivePage}
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}
      <div className="lg:pl-[220px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#dfe3ea] bg-white/95 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex size-10 items-center justify-center rounded-xl border lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </button>
            <div className="hidden items-center gap-2 text-sm sm:flex">
              <span className="text-[#768094]">Admin</span>
              <span className="text-[#bdc3cf]">/</span>
              <span className="font-medium">{activePage === 'Overview' ? 'Home' : activePage === 'Jobs & JDs' ? 'Jobs' : activePage === 'Resume studio' ? 'Resumes' : activePage}</span>
            </div>
          </div>
          <div className="relative flex items-center gap-2.5">
            <button
              onClick={() => previewCandidate(state.candidates[0]?.id)}
              disabled={!state.candidates.length}
              className="hidden h-10 items-center gap-2 rounded-xl border bg-white px-3 text-[11px] font-semibold sm:flex"
            >
              <Eye className="size-4" /> Candidate preview
            </button>
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              aria-label="Notifications"
              className="relative flex size-10 items-center justify-center rounded-xl border bg-white"
            >
              <Bell className="size-[18px]" />
              {state.announcements.some((a) => a.active) && (
                <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#6264e8] ring-2 ring-white" />
              )}
            </button>
            <Button
              onClick={() => openStudio(1)}
              className="h-10 bg-[#5b5de4] text-xs"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">New resume</span>
            </Button>
            {notificationsOpen && (
              <div className="absolute right-12 top-12 w-[320px] overflow-hidden rounded-2xl border bg-white shadow-xl">
                <div className="border-b px-4 py-3">
                  <p className="text-xs font-semibold">
                    Announcements & activity
                  </p>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {state.announcements.slice(0, 3).map((item) => (
                    <div key={item.id} className="border-b px-4 py-3">
                      <p className="text-[11px] font-semibold">{item.title}</p>
                      <p className="mt-1 text-[10px] text-[#7b8496]">
                        {item.message}
                      </p>
                    </div>
                  ))}
                  {state.logs.slice(0, 3).map((log) => (
                    <div key={log.id} className="border-b px-4 py-3">
                      <p className="text-[10px] font-semibold">
                        {log.action.replaceAll('.', ' · ')}
                      </p>
                      <p className="mt-1 text-[9px] text-[#929aaa]">
                        {formatDate(log.createdAt, true)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>
        {busy && (
          <div className="fixed left-[220px] right-0 top-16 z-40 h-0.5 overflow-hidden bg-[#e6e7ff]">
            <div className="h-full w-1/3 animate-[progress_1s_ease-in-out_infinite] bg-[#5b5de4]" />
          </div>
        )}
        <div className="w-full px-4 py-5 sm:px-6 sm:py-6">{content()}</div>
      </div>
    </main>
  );
}
