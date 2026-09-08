CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `api_credentials` (
	`provider` text PRIMARY KEY NOT NULL,
	`cipher_text` text NOT NULL,
	`iv` text NOT NULL,
	`last_four` text NOT NULL,
	`status` text DEFAULT 'connected' NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `application_events` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`event_type` text NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `events_job_idx` ON `application_events` (`job_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `base_resumes` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`version` integer NOT NULL,
	`file_key` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`extracted_text` text DEFAULT '' NOT NULL,
	`is_current` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `base_resumes_candidate_idx` ON `base_resumes` (`candidate_id`,`is_current`);--> statement-breakpoint
CREATE TABLE `candidate_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`name` text NOT NULL,
	`proficiency` text DEFAULT 'Experienced' NOT NULL,
	`years` integer DEFAULT 0 NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'Profile' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `candidate_skills_candidate_idx` ON `candidate_skills` (`candidate_id`);--> statement-breakpoint
CREATE TABLE `candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`headline` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`family` text DEFAULT 'General' NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`portal_enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `candidates_email_unique` ON `candidates` (`email`);--> statement-breakpoint
CREATE INDEX `candidates_status_idx` ON `candidates` (`status`);--> statement-breakpoint
CREATE TABLE `evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`score` integer NOT NULL,
	`results_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text,
	`resume_version_id` text,
	`kind` text NOT NULL,
	`r2_key` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resume_version_id`) REFERENCES `resume_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_r2_key_unique` ON `files` (`r2_key`);--> statement-breakpoint
CREATE TABLE `job_families` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`roles_json` text DEFAULT '[]' NOT NULL,
	`skills_json` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_families_name_unique` ON `job_families` (`name`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`company` text NOT NULL,
	`title` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`work_type` text DEFAULT 'Not specified' NOT NULL,
	`salary` text DEFAULT 'Not listed' NOT NULL,
	`source` text DEFAULT 'Manual' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`jd_text` text NOT NULL,
	`mandatory_skills_json` text DEFAULT '[]' NOT NULL,
	`preferred_skills_json` text DEFAULT '[]' NOT NULL,
	`target_role` text NOT NULL,
	`target_location` text DEFAULT '' NOT NULL,
	`family` text DEFAULT 'General' NOT NULL,
	`status` text DEFAULT 'Selected' NOT NULL,
	`match_score` integer DEFAULT 0 NOT NULL,
	`discovered_at` text NOT NULL,
	`applied_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `jobs_candidate_idx` ON `jobs` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `jobs_candidate_status_idx` ON `jobs` (`candidate_id`,`status`);--> statement-breakpoint
CREATE INDEX `jobs_updated_idx` ON `jobs` (`updated_at`);--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`scope` text DEFAULT 'Global' NOT NULL,
	`template` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `resume_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`job_id` text NOT NULL,
	`parent_id` text,
	`version` integer NOT NULL,
	`content_json` text NOT NULL,
	`skill_plan_json` text DEFAULT '[]' NOT NULL,
	`scores_json` text DEFAULT '{}' NOT NULL,
	`template` text DEFAULT 'Modern ATS' NOT NULL,
	`status` text DEFAULT 'Ready for review' NOT NULL,
	`engine` text DEFAULT 'grounded-fallback' NOT NULL,
	`created_at` text NOT NULL,
	`approved_at` text,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `resumes_candidate_idx` ON `resume_versions` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `resumes_job_idx` ON `resume_versions` (`job_id`,`version`);--> statement-breakpoint
CREATE INDEX `resumes_status_idx` ON `resume_versions` (`status`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
