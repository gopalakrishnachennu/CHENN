'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminPortal, type AdminPage } from './admin-portal';
import { CandidatePortal } from './candidate-portal';
import { PlatformProvider, usePlatform } from '@/lib/platform-context';

type ToolDefinition = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        tool: ToolDefinition,
        options?: { signal?: AbortSignal },
      ) => void | Promise<void>;
    };
  }
}

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb]">
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#172235] text-[#aeb0ff]">
          <LoaderCircle className="size-5 animate-spin" />
        </div>
        <p className="mt-4 text-sm font-semibold text-[#263044]">
          Loading ResumeOS
        </p>
        <p className="mt-1 text-xs text-[#8992a3]">
          Verifying your secure workspace…
        </p>
      </div>
    </main>
  );
}

function LoginScreen() {
  const { signIn, busy, error } = usePlatform();
  return (
    <main className="min-h-screen bg-[#f2f4f9] p-5 sm:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-40px)] max-w-[1180px] overflow-hidden rounded-[30px] border border-white/60 bg-white shadow-[0_28px_80px_rgba(30,40,62,.13)] lg:grid-cols-[1.08fr_.92fr]">
        <section className="relative hidden overflow-hidden bg-[#172235] p-12 text-white lg:flex lg:flex-col">
          <div className="absolute -right-24 -top-24 size-80 rounded-full bg-[#696bf2]/20 blur-2xl" />
          <div className="absolute -bottom-32 -left-20 size-96 rounded-full bg-[#34b990]/10 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#696bf2]">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-base font-semibold">ResumeOS</p>
              <p className="text-[9px] uppercase tracking-[.16em] text-slate-400">
                JD-first operations
              </p>
            </div>
          </div>
          <div className="relative my-auto max-w-lg">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-[#aeb0ff]">
              Admin control · Candidate clarity
            </span>
            <h1 className="mt-7 text-[46px] font-semibold leading-[1.05] tracking-[-.055em]">
              Every resume starts with the job.
            </h1>
            <p className="mt-5 max-w-md text-[14px] leading-6 text-slate-400">
              A complete operations workspace for candidates, job descriptions,
              evidence-safe generation, approval, applications, analytics, and a
              transparent read-only candidate portal.
            </p>
            <div className="mt-9 grid grid-cols-3 gap-3">
              {[
                ['01', 'Analyze JD'],
                ['02', 'Resolve skills'],
                ['03', 'Approve & track'],
              ].map(([number, label]) => (
                <div
                  key={number}
                  className="rounded-2xl border border-white/8 bg-white/[.04] p-4"
                >
                  <p className="text-[10px] font-bold text-[#aeb0ff]">
                    {number}
                  </p>
                  <p className="mt-4 text-[11px] font-semibold text-slate-200">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative flex items-center gap-2 text-[10px] text-slate-500">
            <ShieldCheck className="size-4" /> Role-scoped data · private files
            · admin-browser AI key
          </div>
        </section>
        <section className="flex items-center justify-center p-7 sm:p-12">
          <div className="w-full max-w-[420px]">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#696bf2] text-white">
                <Sparkles className="size-5" />
              </div>
              <div>
                <p className="text-base font-semibold">ResumeOS</p>
                <p className="text-[9px] uppercase tracking-[.16em] text-[#929aaa]">
                  JD-first operations
                </p>
              </div>
            </div>
            <div className="mt-12 lg:mt-0">
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#6466dc]">
                Secure portal
              </p>
              <h2 className="mt-2 text-[30px] font-semibold tracking-[-.045em] text-[#1d2638]">
                Welcome back
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#7b8496]">
                Sign in with your verified Google account. Your email determines
                which portal and records you can access.
              </p>
            </div>
            <div className="mt-8 space-y-3">
              <div className="flex items-start gap-3 rounded-2xl border border-[#e7eaf0] bg-[#fafbfc] p-4">
                <div className="flex size-8 flex-none items-center justify-center rounded-lg bg-[#eef0ff] text-[#5b5dd0]">
                  <LockKeyhole className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Administrator</p>
                  <p className="mt-1 text-[10px] leading-4 text-[#8992a3]">
                    The designated admin Google account receives full control.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-[#e7eaf0] bg-[#fafbfc] p-4">
                <div className="flex size-8 flex-none items-center justify-center rounded-lg bg-[#eaf8f2] text-[#267b60]">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Candidate</p>
                  <p className="mt-1 text-[10px] leading-4 text-[#8992a3]">
                    A linked candidate email receives read-only access to its
                    own data.
                  </p>
                </div>
              </div>
            </div>
            {error && (
              <div className="mt-5 flex gap-2 rounded-xl border border-[#f0dadd] bg-[#fff8f8] p-3 text-[10px] leading-4 text-[#a04b58]">
                <AlertCircle className="mt-0.5 size-4 flex-none" />
                <span>{error}</span>
              </div>
            )}
            <Button
              onClick={() => void signIn().catch(() => undefined)}
              disabled={busy}
              className="mt-6 h-12 w-full rounded-xl bg-[#172235] text-sm hover:bg-[#22304a]"
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <span className="flex size-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#4285F4]">
                  G
                </span>
              )}{' '}
              Continue with Google
            </Button>
            <p className="mt-4 text-center text-[9px] leading-4 text-[#9aa2b1]">
              Authentication is provided by Firebase. Firebase Security Rules
              authorize every database and file request.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function AccessScreen() {
  const { user, error, signOutUser, refresh, busy } = usePlatform();
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-5">
      <div className="w-full max-w-[480px] rounded-3xl border bg-white p-8 text-center shadow-[0_22px_60px_rgba(30,40,62,.1)]">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#fff0f2] text-[#b94253]">
          <AlertCircle className="size-5" />
        </div>
        <h1 className="mt-5 text-xl font-semibold">
          Portal access needs attention
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#7b8496]">
          {error ?? 'Your account could not be linked to a ResumeOS portal.'}
        </p>
        <p className="mt-3 text-[10px] text-[#929aaa]">
          Signed in as {user?.email}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" onClick={() => void signOutUser()}>
            Use another account
          </Button>
          <Button
            disabled={busy}
            onClick={() => void refresh().catch(() => undefined)}
            className="bg-[#5b5de4]"
          >
            Try again
          </Button>
        </div>
      </div>
    </main>
  );
}

function PortalShell() {
  const { state, loading, user } = usePlatform();
  const [adminPage, setAdminPage] = useState<AdminPage>('Overview');
  const [studioStep, setStudioStep] = useState(1);
  const [studioJobId, setStudioJobId] = useState<string | null>(null);
  const [previewCandidateId, setPreviewCandidateId] = useState<string | null>(
    null,
  );
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  } | null>(null);

  const notify = useCallback(
    (message: string, tone: 'success' | 'error' = 'success') => {
      setToast({ message, tone });
      window.setTimeout(() => setToast(null), 4200);
    },
    [],
  );

  const navigateAdmin = useCallback(
    (next: AdminPage) => {
      if (next === adminPage && !previewCandidateId) return;
      window.history.pushState(
        { resumeOS: { view: 'admin', page: next } },
        '',
        `#admin/${encodeURIComponent(next.toLowerCase().replaceAll(' ', '-'))}`,
      );
      setPreviewCandidateId(null);
      setAdminPage(next);
    },
    [adminPage, previewCandidateId],
  );

  const previewCandidate = useCallback(
    (candidateId: string) => {
      window.history.pushState(
        {
          resumeOS: {
            view: 'admin-preview',
            page: adminPage,
            candidateId,
          },
        },
        '',
        `#admin/candidates/preview/${encodeURIComponent(candidateId)}`,
      );
      setPreviewCandidateId(candidateId);
    },
    [adminPage],
  );

  const exitCandidatePreview = useCallback(() => {
    if (window.history.state?.resumeOS?.view === 'admin-preview') {
      window.history.back();
      return;
    }
    setPreviewCandidateId(null);
    navigateAdmin('Candidates');
  }, [navigateAdmin]);

  useEffect(() => {
    if (state?.role !== 'admin') return;
    const pages: AdminPage[] = [
      'Job matching',
      'Gmail',
      'Overview',
      'Candidates',
      'Jobs & JDs',
      'Resume studio',
      'Resume history',
      'Intelligence',
      'Platform',
      'Operations',
    ];
    const pageFromHash = () => {
      const slug = decodeURIComponent(
        window.location.hash.replace(/^#admin\//, ''),
      );
      return pages.find(
        (page) => page.toLowerCase().replaceAll(' ', '-') === slug,
      );
    };
    const saved = window.history.state?.resumeOS as
      | {
          view?: string;
          page?: AdminPage;
          candidateId?: string;
        }
      | undefined;
    const initialPage = saved?.page ?? pageFromHash() ?? 'Overview';
    setAdminPage(initialPage);
    if (saved?.view === 'admin-preview' && saved.candidateId) {
      setPreviewCandidateId(saved.candidateId);
    } else {
      setPreviewCandidateId(null);
    }
    if (!saved) {
      const route = `#admin/${encodeURIComponent(initialPage.toLowerCase().replaceAll(' ', '-'))}`;
      const entry = { resumeOS: { view: 'admin', page: initialPage } };
      window.history.replaceState(entry, '', route);
      window.history.pushState(entry, '', route);
    }
    const restore = (event: PopStateEvent) => {
      const restored = event.state?.resumeOS as
        | {
            view?: string;
            page?: AdminPage;
            candidateId?: string;
          }
        | undefined;
      if (restored?.view === 'admin-preview' && restored.candidateId) {
        setAdminPage(restored.page ?? 'Candidates');
        setPreviewCandidateId(restored.candidateId);
        return;
      }
      if (restored?.view === 'admin' && restored.page) {
        setPreviewCandidateId(null);
        setAdminPage(restored.page);
      }
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [state?.role]);

  useEffect(() => {
    if (state?.role !== 'admin') return;
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'start_resume_generation',
          title: 'Start resume generation',
          description:
            'Open the administrator Resume Studio at step one of the JD-first workflow.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            if (
              input === null ||
              typeof input !== 'object' ||
              Array.isArray(input)
            )
              throw new Error('Input must be an object.');
            setPreviewCandidateId(null);
            setStudioJobId(null);
            navigateAdmin('Resume studio');
            setStudioStep(1);
            return { view: 'admin', page: 'Resume studio', step: 1 };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [navigateAdmin, state?.role]);

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen />;
  if (!state) return <AccessScreen />;

  return (
    <>
      {state.role === 'admin' && !previewCandidateId ? (
        <AdminPortal
          activePage={adminPage}
          setActivePage={navigateAdmin}
          studioStep={studioStep}
          setStudioStep={setStudioStep}
          studioJobId={studioJobId}
          setStudioJobId={setStudioJobId}
          previewCandidate={previewCandidate}
          notify={notify}
        />
      ) : (
        <CandidatePortal
          candidateId={previewCandidateId ?? state.user.candidateId}
          exitPreview={
            state.role === 'admin' ? exitCandidatePreview : undefined
          }
          notify={notify}
        />
      )}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 left-1/2 z-[100] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2.5 rounded-xl border px-4 py-3 text-[11px] font-medium text-white shadow-[0_18px_50px_rgba(23,34,53,.25)] ${toast.tone === 'error' ? 'border-[#7c3440] bg-[#a03f4e]' : 'border-[#26344c] bg-[#172235]'}`}
        >
          <span
            className={`flex size-5 flex-none items-center justify-center rounded-full ${toast.tone === 'error' ? 'bg-white/15' : 'bg-[#5ac39f]/20 text-[#70d4b3]'}`}
          >
            {toast.tone === 'error' ? (
              <AlertCircle className="size-3.5" />
            ) : (
              <CheckCircle2 className="size-3.5" />
            )}
          </span>
          <span>{toast.message}</span>
        </div>
      )}
    </>
  );
}

export default function Home() {
  return (
    <PlatformProvider>
      <PortalShell />
    </PlatformProvider>
  );
}
