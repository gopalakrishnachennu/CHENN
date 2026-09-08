import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../lib/default-settings';
import { portalFontStack, portalThemeStyle } from '../lib/portal-theme';
import { evaluateReleaseHealth } from '../lib/release-health';
import type { AppState } from '../lib/types';

function healthyState(): AppState {
  const createdAt = '2026-09-07T00:00:00.000Z';
  return {
    role: 'admin',
    user: { email: 'gopalakrishnachennu@gmail.com', name: 'Gopalakrishna' },
    candidates: [
      {
        id: 'candidate-1',
        email: 'candidate@example.com',
        firstName: 'Test',
        lastName: 'Candidate',
        name: 'Test Candidate',
        initials: 'TC',
        phone: '',
        headline: 'Engineer',
        summary: 'Verified evidence.',
        location: 'Remote',
        family: 'DevOps',
        status: 'Active',
        portalEnabled: true,
        skills: [],
        createdAt,
        updatedAt: createdAt,
      },
    ],
    jobs: [
      {
        id: 'job-1',
        candidateId: 'candidate-1',
        company: 'Example',
        title: 'Engineer',
        location: 'Remote',
        workType: 'Remote',
        salary: '',
        source: 'Test',
        sourceUrl: '',
        jdText: 'AWS required.',
        mandatorySkills: ['AWS'],
        preferredSkills: [],
        targetRole: 'Engineer',
        targetLocation: 'Remote',
        family: 'DevOps',
        status: 'Applied',
        matchScore: 100,
        discoveredAt: createdAt,
        appliedAt: createdAt,
        appliedResumeId: 'resume-1',
        createdAt,
        updatedAt: createdAt,
      },
    ],
    resumes: [
      {
        id: 'resume-1',
        candidateId: 'candidate-1',
        jobId: 'job-1',
        parentId: null,
        version: 1,
        content: {
          name: 'Test Candidate',
          headline: 'Engineer',
          contact: 'candidate@example.com',
          summary: 'Verified evidence.',
          skills: [],
          experience: [],
          education: [],
        },
        skillPlan: [],
        scores: { jdMatch: 100, ats: 100, recruiterSafe: 100, evidence: 100 },
        template: 'Modern ATS',
        status: 'Approved',
        engine: 'evidence-safe',
        createdAt,
        approvedAt: createdAt,
        candidateVisible: true,
      } as AppState['resumes'][number],
    ],
    events: [],
    families: [
      {
        id: 'family-1',
        name: 'DevOps',
        description: '',
        roles: ['Engineer'],
        skills: ['AWS'],
        active: true,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    prompts: [
      {
        id: 'prompt-1',
        name: 'Grounded',
        scope: 'Global',
        template: 'Use evidence.',
        version: 1,
        active: true,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    settings: structuredClone(DEFAULT_SETTINGS),
    announcements: [],
    evaluations: [
      {
        id: 'evaluation-1',
        name: 'Production release gate',
        status: 'Passed',
        score: 100,
        results: {},
        createdAt,
      },
    ],
    logs: [
      {
        id: 'log-1',
        actorEmail: 'gopalakrishnachennu@gmail.com',
        action: 'test',
        entityType: 'system',
        entityId: 'release',
        details: {},
        createdAt,
      },
    ],
    credential: { connected: false },
  };
}

describe('portal appearance', () => {
  it('maps every selectable font to a real bundled family', () => {
    expect(portalFontStack('Geist Sans')).toContain('Geist Variable');
    expect(portalFontStack('Inter')).toContain('Inter Variable');
    expect(portalFontStack('Source Sans 3')).toContain(
      'Source Sans 3 Variable',
    );
  });

  it('produces live accent tokens from saved settings', () => {
    const style = portalThemeStyle({
      primaryColor: '#267D67',
      fontFamily: 'Inter',
    });
    expect(style['--portal-accent']).toBe('#267D67');
    expect(style.fontFamily).toContain('Inter Variable');
  });
});

describe('production release health', () => {
  it('passes a complete and internally consistent workspace', () => {
    const result = evaluateReleaseHealth(healthyState());
    expect(result.ready).toBe(true);
    expect(result.score).toBe(100);
  });

  it('blocks orphaned jobs and missing applied resumes', () => {
    const state = healthyState();
    state.jobs[0].candidateId = 'missing-candidate';
    state.jobs[0].appliedResumeId = null;
    const result = evaluateReleaseHealth(state);
    expect(result.ready).toBe(false);
    expect(result.checks.find((item) => item.id === 'jobs')?.ready).toBe(false);
    expect(
      result.checks.find((item) => item.id === 'applications')?.ready,
    ).toBe(false);
  });

  it('blocks invalid theme configuration and failed evaluations', () => {
    const state = healthyState();
    state.settings.primaryColor = 'purple';
    state.settings.fontFamily = 'Unknown Font';
    state.evaluations[0].status = 'Blocked';
    const result = evaluateReleaseHealth(state);
    expect(result.checks.find((item) => item.id === 'appearance')?.ready).toBe(
      false,
    );
    expect(result.checks.find((item) => item.id === 'evaluation')?.ready).toBe(
      false,
    );
  });
});
