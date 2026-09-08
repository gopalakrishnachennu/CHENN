import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const candidates = sqliteTable(
  'candidates',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: text('phone').notNull().default(''),
    headline: text('headline').notNull().default(''),
    summary: text('summary').notNull().default(''),
    location: text('location').notNull().default(''),
    family: text('family').notNull().default('General'),
    status: text('status', { enum: ['Active', 'Paused', 'Archived'] }).notNull().default('Active'),
    portalEnabled: integer('portal_enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    archivedAt: text('archived_at'),
  },
  (table) => [
    uniqueIndex('candidates_email_unique').on(table.email),
    index('candidates_status_idx').on(table.status),
  ],
);

export const candidateSkills = sqliteTable(
  'candidate_skills',
  {
    id: text('id').primaryKey(),
    candidateId: text('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    proficiency: text('proficiency').notNull().default('Experienced'),
    years: integer('years').notNull().default(0),
    evidence: text('evidence').notNull().default(''),
    source: text('source').notNull().default('Profile'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('candidate_skills_candidate_idx').on(table.candidateId)],
);

export const jobFamilies = sqliteTable(
  'job_families',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    rolesJson: text('roles_json').notNull().default('[]'),
    skillsJson: text('skills_json').notNull().default('[]'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('job_families_name_unique').on(table.name)],
);

export const baseResumes = sqliteTable(
  'base_resumes',
  {
    id: text('id').primaryKey(),
    candidateId: text('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    fileKey: text('file_key').notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    extractedText: text('extracted_text').notNull().default(''),
    isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('base_resumes_candidate_idx').on(table.candidateId, table.isCurrent)],
);

export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    candidateId: text('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade' }),
    company: text('company').notNull(),
    title: text('title').notNull(),
    location: text('location').notNull().default(''),
    workType: text('work_type').notNull().default('Not specified'),
    salary: text('salary').notNull().default('Not listed'),
    source: text('source').notNull().default('Manual'),
    sourceUrl: text('source_url').notNull().default(''),
    jdText: text('jd_text').notNull(),
    mandatorySkillsJson: text('mandatory_skills_json').notNull().default('[]'),
    preferredSkillsJson: text('preferred_skills_json').notNull().default('[]'),
    targetRole: text('target_role').notNull(),
    targetLocation: text('target_location').notNull().default(''),
    family: text('family').notNull().default('General'),
    status: text('status', { enum: ['Selected', 'Pending', 'Applied', 'Interview', 'Rejected', 'Offer', 'Failed'] }).notNull().default('Selected'),
    matchScore: integer('match_score').notNull().default(0),
    discoveredAt: text('discovered_at').notNull(),
    appliedAt: text('applied_at'),
    appliedResumeId: text('applied_resume_id'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('jobs_candidate_idx').on(table.candidateId),
    index('jobs_candidate_status_idx').on(table.candidateId, table.status),
    index('jobs_updated_idx').on(table.updatedAt),
  ],
);

export const resumeVersions = sqliteTable(
  'resume_versions',
  {
    id: text('id').primaryKey(),
    candidateId: text('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade' }),
    jobId: text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    version: integer('version').notNull(),
    contentJson: text('content_json').notNull(),
    skillPlanJson: text('skill_plan_json').notNull().default('[]'),
    scoresJson: text('scores_json').notNull().default('{}'),
    template: text('template').notNull().default('Modern ATS'),
    status: text('status', { enum: ['Draft', 'Ready for review', 'Approved', 'Superseded'] }).notNull().default('Ready for review'),
    engine: text('engine').notNull().default('grounded-fallback'),
    createdAt: text('created_at').notNull(),
    approvedAt: text('approved_at'),
  },
  (table) => [
    index('resumes_candidate_idx').on(table.candidateId),
    index('resumes_job_idx').on(table.jobId, table.version),
    index('resumes_status_idx').on(table.status),
  ],
);

export const applicationEvents = sqliteTable(
  'application_events',
  {
    id: text('id').primaryKey(),
    jobId: text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    title: text('title').notNull(),
    detail: text('detail').notNull().default(''),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('events_job_idx').on(table.jobId, table.createdAt)],
);

export const prompts = sqliteTable('prompts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  scope: text('scope').notNull().default('Global'),
  template: text('template').notNull(),
  version: integer('version').notNull().default(1),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull(),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by').notNull(),
});

export const apiCredentials = sqliteTable('api_credentials', {
  provider: text('provider').primaryKey(),
  cipherText: text('cipher_text').notNull(),
  iv: text('iv').notNull(),
  lastFour: text('last_four').notNull(),
  status: text('status').notNull().default('connected'),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by').notNull(),
});

export const files = sqliteTable(
  'files',
  {
    id: text('id').primaryKey(),
    candidateId: text('candidate_id').references(() => candidates.id, { onDelete: 'cascade' }),
    resumeVersionId: text('resume_version_id').references(() => resumeVersions.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    r2Key: text('r2_key').notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('files_r2_key_unique').on(table.r2Key)],
);

export const announcements = sqliteTable('announcements', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const evaluations = sqliteTable('evaluations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull(),
  score: integer('score').notNull(),
  resultsJson: text('results_json').notNull(),
  createdAt: text('created_at').notNull(),
});

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorEmail: text('actor_email').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    detailsJson: text('details_json').notNull().default('{}'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('audit_created_idx').on(table.createdAt)],
);
