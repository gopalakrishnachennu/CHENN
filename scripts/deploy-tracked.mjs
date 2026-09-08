import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Only the manually approved GitHub workflow deploys. Local builds remain available.
if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.DEPLOYMENT_ID || process.env.LIVE_QA_APPROVED !== 'true') {
  throw new Error('Use the Deploy Firebase workflow with recorded live QA approval. No deployment was attempted.');
}
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git('status', '--porcelain')) throw new Error('Deployment requires a clean checkout.');
const commit = git('rev-parse', 'HEAD');
if (commit !== process.env.GITHUB_SHA) throw new Error('Checked-out commit does not match the workflow.');
mkdirSync('deployment/runs', { recursive: true });
const record = {
  schemaVersion: 1, commit, deploymentId: process.env.DEPLOYMENT_ID,
  actor: process.env.GITHUB_ACTOR, startedAt: new Date().toISOString(),
  workflow: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  attempt: process.env.GITHUB_RUN_ATTEMPT, target: 'https://chenn.web.app',
  scope: 'firestore,storage,hosting', status: 'testing', previousRelease: null,
  checks: {},
};
const save = () => writeFileSync('deployment/runs/result.json', JSON.stringify(record, null, 2));
const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) throw new Error(`${command} failed with exit ${result.status}`);
};
save();
try {
  const previous = await fetch('https://chenn.web.app/release.json', { signal: AbortSignal.timeout(15000), cache: 'no-store' });
  if (!previous.ok) throw new Error('Cannot inspect current release before deployment.');
  const body = await previous.text();
  if (previous.headers.get('content-type')?.includes('application/json')) {
    const data = JSON.parse(body);
    if (!/^[a-f0-9]{40}$/.test(data.commit)) throw new Error('Invalid previous release metadata.');
    record.previousRelease = { commit: data.commit, deploymentId: data.deploymentId };
  } else if (body.trimStart().toLowerCase().startsWith('<!doctype html')) {
    record.previousRelease = { legacy: true, note: 'Release predates tracing; use Firebase release history for rollback.' };
  } else throw new Error('Unrecognized previous release response.');
  run('npm', ['run', 'release:check']);
  record.checks.automated = 'passed';
  record.checks.liveQA = { approvedBy: process.env.GITHUB_ACTOR, approved: true };
  record.lockfileSha256 = createHash('sha256').update(readFileSync('package-lock.json')).digest('hex');
  const publicRelease = { commit, deploymentId: record.deploymentId, builtAt: new Date().toISOString(), workflow: record.workflow };
  writeFileSync('firebase-dist/release.json', JSON.stringify(publicRelease, null, 2));
  record.status = 'deploying'; save();
  run('firebase', ['deploy', '--only', record.scope, '--project', 'chennu4169', '--non-interactive', '--message', `commit=${commit} run=${process.env.GITHUB_RUN_ID} deployment=${record.deploymentId}`]);
  record.status = 'verifying'; save();
  const response = await fetch(`https://chenn.web.app/release.json?deployment=${record.deploymentId}`, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
  const published = await response.json();
  if (!response.ok || published.commit !== commit || published.deploymentId !== record.deploymentId) throw new Error('Published release identity could not be verified. Inspect Firebase; deployment may have succeeded.');
  record.status = 'success';
} catch (error) {
  record.failedDuring = record.status;
  record.status = 'failure'; record.error = error.message; process.exitCode = 1;
} finally { record.finishedAt = new Date().toISOString(); save(); }
