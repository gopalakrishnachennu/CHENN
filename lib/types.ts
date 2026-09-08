export type Role = 'admin' | 'candidate';
export type ApplicationStatus = 'Selected' | 'Pending' | 'Applied' | 'Interview' | 'Rejected' | 'Offer' | 'Failed';
export type ResumeStatus = 'Draft' | 'Ready for review' | 'Approved' | 'Superseded';
export type SkillSource = 'Profile' | 'JD + Family' | 'Supporting' | 'Missing';

export type CandidateSkill = {
  id: string;
  name: string;
  proficiency: string;
  years: number;
  evidence: string;
  evidenceRefs?: string[];
  source: string;
};

export type ClaimEvidence = {
  claimId: string;
  section: 'summary' | 'experience' | 'projects' | 'skills';
  outputText: string;
  sourceRef: string;
  sourceText: string;
};

export type GenerationSnapshot = {
  candidateUpdatedAt: string;
  jobUpdatedAt: string;
  catalogId?: string;
  matchPolicyVersion: string;
  promptId?: string;
  promptVersion?: number;
  model: string;
  template: string;
  inputHash: string;
};

export type ResumeValidation = {
  passed: boolean;
  errors: string[];
  warnings: string[];
  claimCount: number;
};

export type Candidate = {
  career?: import('./career').Career;
  matchPreferences?: import('./matching').CandidatePreferences;
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  initials: string;
  phone: string;
  headline: string;
  summary: string;
  location: string;
  family: string;
  status: 'Active' | 'Paused' | 'Archived';
  portalEnabled: boolean;
  skills: CandidateSkill[];
  baseResume?: BaseResume;
  createdAt: string;
  updatedAt: string;
};

export type BaseResume = {
  id: string;
  candidateId: string;
  version: number;
  originalName: string;
  mimeType: string;
  byteSize: number;
  extractedText: string;
  createdAt: string;
};

export type Job = {
  catalogId?: string;
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
  mandatorySkills: string[];
  preferredSkills: string[];
  targetRole: string;
  targetLocation: string;
  family: string;
  status: ApplicationStatus;
  matchScore: number;
  discoveredAt: string;
  appliedAt: string | null;
  appliedResumeId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SkillPlanItem = {
  name: string;
  source: SkillSource;
  required: boolean;
  detail: string;
};

export type ResumeContent = {
  certifications?: string[];
  projects?: string[];
  name: string;
  headline: string;
  contact: string;
  summary: string;
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    location: string;
    dates: string;
    bullets: string[];
  }>;
  education: string[];
};

export type ResumeVersion = {
  id: string;
  candidateId: string;
  jobId: string;
  parentId: string | null;
  version: number;
  content: ResumeContent;
  skillPlan: SkillPlanItem[];
  scores: { jdMatch: number; ats: number; recruiterSafe: number; evidence: number };
  template: string;
  status: ResumeStatus;
  engine: string;
  evidenceMap?: ClaimEvidence[];
  generationSnapshot?: GenerationSnapshot;
  validation?: ResumeValidation;
  createdAt: string;
  approvedAt: string | null;
};

export type ApplicationEvent = {
  id: string;
  jobId: string;
  eventType: string;
  title: string;
  detail: string;
  createdAt: string;
};

export type JobFamily = {
  id: string;
  name: string;
  description: string;
  roles: string[];
  skills: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Prompt = {
  id: string;
  name: string;
  scope: string;
  template: string;
  version: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlatformSettings = {
  gmailServiceUrl?: string;
  portalName: string;
  adminName: string;
  primaryColor: string;
  fontFamily: string;
  navigation: { overview: boolean; applications: boolean; resumes: boolean };
  widgets: { totals: boolean; recentApplications: boolean; announcement: boolean };
  visibility: { fullJd: boolean; skillProvenance: boolean; resumeDownloads: boolean; salary: boolean };
  guardrails: { familyMatch: boolean; relatedRoles: 'allow' | 'review' | 'block'; supportingContext: boolean; unrelatedSkills: 'block' };
  notifications: { welcome: string; resumeApproved: string; statusChanged: string };
  system: { timezone: string; dateFormat: string; openAIModel: string };
  templates: string[];
  locations: string[];
  logoFileId?: string;
};

export type Announcement = { id: string; title: string; message: string; active: boolean; createdAt: string };
export type Evaluation = { id: string; name: string; status: string; score: number; results: Record<string, unknown>; createdAt: string };
export type AuditLog = { id: string; actorEmail: string; action: string; entityType: string; entityId: string; details: Record<string, unknown>; createdAt: string };

export type AppState = {
  role: Role;
  user: { email: string; name: string; candidateId?: string };
  candidates: Candidate[];
  jobs: Job[];
  resumes: ResumeVersion[];
  events: ApplicationEvent[];
  families: JobFamily[];
  prompts: Prompt[];
  settings: PlatformSettings;
  announcements: Announcement[];
  evaluations: Evaluation[];
  logs: AuditLog[];
  credential: { connected: boolean; lastFour?: string; updatedAt?: string };
};
