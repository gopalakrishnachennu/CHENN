import type { PlatformSettings } from './types';

export const DEFAULT_SETTINGS: PlatformSettings = {
  portalName: 'ResumeOS Career Portal',
  adminName: 'Gopalakrishna Chennu',
  primaryColor: '#5B5DE4',
  fontFamily: 'Geist Sans',
  navigation: { overview: true, applications: true, resumes: true },
  widgets: { totals: true, recentApplications: true, announcement: true },
  visibility: {
    fullJd: true,
    skillProvenance: true,
    resumeDownloads: true,
    salary: true,
  },
  guardrails: {
    familyMatch: true,
    relatedRoles: 'review',
    supportingContext: true,
    unrelatedSkills: 'block',
  },
  notifications: {
    welcome: 'Welcome back. Your application activity is up to date.',
    resumeApproved: 'A new resume has been approved for one of your jobs.',
    statusChanged: 'An application status was updated.',
  },
  system: {
    timezone: 'America/New_York',
    dateFormat: 'MMM d, yyyy',
    openAIModel: 'gpt-5.5',
  },
  templates: ['Modern ATS', 'Classic ATS', 'Compact Technical'],
  locations: [
    'United States · Remote',
    'Seattle Metro',
    'New York Metro',
    'Austin Metro',
  ],
  onboardingForm: {
    title: 'Tell us about yourself',
    subtitle: 'Fields marked * are required. Enter verified facts only.',
    showEducation: true,
    showProjects: true,
    showBaseResume: true,
    requireHeadline: false,
    requireEducation: false,
    requireProjects: false,
  },
};
