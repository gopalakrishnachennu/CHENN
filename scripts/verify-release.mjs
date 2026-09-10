import { setTimeout as delay } from 'node:timers/promises';

// Hosting propagation can briefly return the previous release after deploy succeeds.
// Retry reads only; never redeploy or accept a different release identity.
export async function verifyRelease(target, expected, { fetcher = fetch, wait = delay, attempts = 6 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const url = new URL('/release.json', target);
      url.searchParams.set('deployment', expected.deploymentId);
      url.searchParams.set('verification', `${Date.now()}-${attempt}`);
      const response = await fetcher(url, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
      const published = await response.json();
      if (response.ok && published.commit === expected.commit && published.deploymentId === expected.deploymentId) return published;
    } catch {
      // Transient network and JSON errors are retried within the same bounded check.
    }
    if (attempt < attempts) await wait(2000);
  }
  throw new Error('Published release identity could not be verified. Inspect Firebase; deployment may have succeeded.');
}
