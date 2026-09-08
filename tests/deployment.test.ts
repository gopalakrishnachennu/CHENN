import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('Deployment entrypoint safeguards', () => {
  it.each([
    { GITHUB_ACTIONS: 'false', DEPLOYMENT_ID: '1', LIVE_QA_APPROVED: 'true' },
    { GITHUB_ACTIONS: 'true', DEPLOYMENT_ID: '', LIVE_QA_APPROVED: 'true' },
    { GITHUB_ACTIONS: 'true', DEPLOYMENT_ID: '1', LIVE_QA_APPROVED: 'false' },
  ])('blocks before any deployment when required evidence is missing: %j', (environment) => {
    const result = spawnSync(process.execPath, ['scripts/deploy-tracked.mjs'], {
      encoding: 'utf8', env: { ...process.env, ...environment, GITHUB_REF: 'refs/heads/main' },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('No deployment was attempted');
  });
});
