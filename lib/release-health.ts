import { ADMIN_EMAIL } from './constants';
import { PORTAL_FONTS } from './portal-theme';
import type { AppState, ResumeVersion } from './types';

export type ReleaseCheck = {
  id: string;
  label: string;
  ready: boolean;
  detail: string;
};

export type ReleaseHealth = {
  ready: boolean;
  score: number;
  passed: number;
  total: number;
  checks: ReleaseCheck[];
};

export function evaluateReleaseHealth(
  state: AppState,
  ignoreEvaluation = false,
): ReleaseHealth {
  const candidateIds = new Set(state.candidates.map((item) => item.id));
  const jobIds = new Set(state.jobs.map((item) => item.id));
  const resumeIds = new Set(state.resumes.map((item) => item.id));
  const invalidJobs = state.jobs.filter(
    (item) => !candidateIds.has(item.candidateId),
  );
  const invalidResumes = state.resumes.filter(
    (item) => !candidateIds.has(item.candidateId) || !jobIds.has(item.jobId),
  );
  const appliedWithoutResume = state.jobs.filter(
    (item) =>
      ['Applied', 'Interview', 'Rejected', 'Offer'].includes(item.status) &&
      (!item.appliedResumeId || !resumeIds.has(item.appliedResumeId)),
  );
  const visibleResumeProblems = state.resumes.filter((item) => {
    const value = item as ResumeVersion & { candidateVisible?: boolean };
    return item.status === 'Approved' && value.candidateVisible === false;
  });
  const duplicateEmails = state.candidates.filter(
    (candidate, index) =>
      state.candidates.findIndex(
        (other) => other.email.toLowerCase() === candidate.email.toLowerCase(),
      ) !== index,
  );
  const latestEvaluation = [...state.evaluations].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )[0];
  const settingsReady =
    /^#[0-9a-f]{6}$/i.test(state.settings.primaryColor) &&
    (PORTAL_FONTS as readonly string[]).includes(state.settings.fontFamily) &&
    Object.values(state.settings.navigation).some(Boolean);

  const checks: ReleaseCheck[] = [
    {
      id: 'access',
      label: 'Administrator access',
      ready:
        state.role === 'admin' &&
        state.user.email.toLowerCase() === ADMIN_EMAIL,
      detail: `Admin identity is restricted to ${ADMIN_EMAIL}.`,
    },
    {
      id: 'candidates',
      label: 'Candidate records',
      ready: state.candidates.length > 0 && duplicateEmails.length === 0,
      detail: duplicateEmails.length
        ? `${duplicateEmails.length} duplicate candidate email(s).`
        : `${state.candidates.length} candidate profile(s) available.`,
    },
    {
      id: 'jobs',
      label: 'Jobs and JD integrity',
      ready: invalidJobs.length === 0,
      detail: invalidJobs.length
        ? `${invalidJobs.length} job(s) have no valid candidate.`
        : `${state.jobs.length} job/JD record(s) linked correctly.`,
    },
    {
      id: 'resumes',
      label: 'Resume generation records',
      ready: invalidResumes.length === 0,
      detail: invalidResumes.length
        ? `${invalidResumes.length} orphaned resume version(s).`
        : `${state.resumes.length} resume version(s) linked correctly.`,
    },
    {
      id: 'applications',
      label: 'Applied-resume traceability',
      ready: appliedWithoutResume.length === 0,
      detail: appliedWithoutResume.length
        ? `${appliedWithoutResume.length} submitted application(s) lack an applied resume.`
        : 'Every submitted application identifies the exact resume used.',
    },
    {
      id: 'candidate-visibility',
      label: 'Candidate resume visibility',
      ready: visibleResumeProblems.length === 0,
      detail: visibleResumeProblems.length
        ? `${visibleResumeProblems.length} approved resume(s) are not candidate-visible.`
        : 'Approved resumes are available to their linked candidates.',
    },
    {
      id: 'taxonomy',
      label: 'Taxonomy and prompts',
      ready:
        state.families.some((item) => item.active) &&
        state.prompts.some((item) => item.active),
      detail: `${state.families.filter((item) => item.active).length} active job families · ${state.prompts.filter((item) => item.active).length} active prompts.`,
    },
    {
      id: 'appearance',
      label: 'Brand, color and font settings',
      ready: settingsReady,
      detail: settingsReady
        ? `${state.settings.primaryColor} · ${state.settings.fontFamily} · portal navigation enabled.`
        : 'Appearance settings contain an invalid color, font, or navigation configuration.',
    },
    {
      id: 'audit',
      label: 'Audit logging',
      ready: state.logs.length > 0,
      detail: `${state.logs.length} recent administrative audit event(s) loaded.`,
    },
    {
      id: 'evaluation',
      label: 'Latest release evaluation',
      ready:
        ignoreEvaluation ||
        (latestEvaluation?.status === 'Passed' &&
          latestEvaluation.score === 100),
      detail: ignoreEvaluation
        ? 'Evaluation is running against current production data.'
        : latestEvaluation
          ? `${latestEvaluation.status} · ${latestEvaluation.score}% · ${new Date(latestEvaluation.createdAt).toLocaleString()}`
          : 'No release evaluation has been run.',
    },
  ];
  const passed = checks.filter((item) => item.ready).length;
  return {
    ready: passed === checks.length,
    score: Math.round((passed / checks.length) * 100),
    passed,
    total: checks.length,
    checks,
  };
}
