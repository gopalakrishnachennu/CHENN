import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const steps = [
  ['npm', ['test']],
  ['npm', ['run', 'test:rules']],
  ['npx', ['tsc', '--noEmit', '--incremental', 'false']],
  ['npm', ['run', 'build:firebase']],
  ['npx', ['wrangler', 'deploy', '--dry-run', '--config', 'workers/gmail/wrangler.jsonc', '--outdir', 'deployment/gmail-worker-build']],
];

for (const [command, args] of steps) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const backend = readFileSync(
  new URL('../lib/firebase-backend.ts', import.meta.url),
  'utf8',
);
const requiredActions = [
  'candidate.create',
  'candidate.update',
  'candidate.archive',
  'candidate.delete',
  'candidate.skills.replace',
  'job.create',
  'job.update',
  'job.status',
  'job.delete',
  'resume.generate',
  'resume.edit',
  'resume.approve',
  'family.save',
  'family.delete',
  'prompt.save',
  'settings.update',
  'announcement.save',
  'announcement.delete',
  'evaluation.run',
];
// Supported for existing records and migrations, but intentionally omitted from
// candidate onboarding because verified skills now come from career evidence.
const headlessActions = ['candidate.skills.replace'];
const missing = requiredActions.filter(
  (action) => !backend.includes(`action === '${action}'`),
);
if (missing.length)
  throw new Error(
    `Release blocked: missing action handlers: ${missing.join(', ')}`,
  );

const adminPortal = readFileSync(
  new URL('../app/admin-portal.tsx', import.meta.url),
  'utf8',
);
const unlabeledIconActions = [
  ...adminPortal.matchAll(
    /<button(?=[^>]*className="[^"]*size-8)(?![^>]*aria-label)[^>]*>/g,
  ),
];
if (unlabeledIconActions.length) {
  throw new Error(
    `Release blocked: ${unlabeledIconActions.length} icon-only admin action(s) have no accessible label.`,
  );
}
const uiActions = [...adminPortal.matchAll(/act\(\s*['"]([^'"]+)['"]/g)].map(
  (match) => match[1],
);
const uiActionsWithoutHandlers = [...new Set(uiActions)].filter(
  (action) => !requiredActions.includes(action),
);
const handlersWithoutUi = requiredActions.filter(
  (action) => !uiActions.includes(action) && !headlessActions.includes(action),
);
if (uiActionsWithoutHandlers.length || handlersWithoutUi.length) {
  throw new Error(
    `Release blocked: UI/backend action mismatch. UI-only: ${uiActionsWithoutHandlers.join(', ') || 'none'}; backend-only: ${handlersWithoutUi.join(', ') || 'none'}`,
  );
}
if (!existsSync(new URL('../firebase-dist/index.html', import.meta.url)))
  throw new Error('Release blocked: production index was not built.');

const firestoreRules = readFileSync(
  new URL('../firestore.rules', import.meta.url),
  'utf8',
);
const storageRules = readFileSync(
  new URL('../storage.rules', import.meta.url),
  'utf8',
);
if (
  !firestoreRules.includes('allow read, write: if false') ||
  !storageRules.includes('allow read, write: if false')
) {
  throw new Error(
    'Release blocked: Firebase rules do not contain a default-deny boundary.',
  );
}

console.log(
  `\nRELEASE GATE PASSED: ${requiredActions.length} action contracts, tests, types, build, and default-deny rules verified.`,
);
