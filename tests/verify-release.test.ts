import { describe, expect, it, vi } from 'vitest';
import { verifyRelease } from '../scripts/verify-release.mjs';

const expected = { commit: 'current-commit', deploymentId: 'current-deployment' };
const response = (body = expected, ok = true) => ({ ok, json: async () => body });
describe('Published release verification', () => {
  it('waits for propagation and verifies both commit and deployment', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ ...expected, commit: 'old' }))
      .mockResolvedValueOnce(response({ ...expected, deploymentId: 'old' })).mockResolvedValue(response());
    const wait = vi.fn();
    await expect(verifyRelease('https://chenn.web.app', expected, { fetcher, wait })).resolves.toEqual(expected);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0][0])).not.toBe(String(fetcher.mock.calls[1][0]));
  });
  it('retries a transient fetch failure', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue(response());
    await expect(verifyRelease('https://chenn.web.app', expected, { fetcher, wait: vi.fn() })).resolves.toEqual(expected);
  });
  it('fails closed when the identity cannot be verified', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(expected, false));
    await expect(verifyRelease('https://chenn.web.app', expected, { fetcher, wait: vi.fn(), attempts: 3 })).rejects.toThrow('could not be verified');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
