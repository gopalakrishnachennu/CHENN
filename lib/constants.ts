export const ADMIN_EMAIL = 'gopalakrishnachennu@gmail.com';
export const FIREBASE_PROJECT_ID = 'chennu4169';

export const APPLICATION_STATUSES = [
  'Selected',
  'Pending',
  'Applied',
  'Interview',
  'Rejected',
  'Offer',
  'Failed',
] as const;

export const ACCEPTED_RESUME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
