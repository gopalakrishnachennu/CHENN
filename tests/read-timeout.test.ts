import { afterEach, describe, expect, it, vi } from 'vitest';
import { withReadTimeout } from '../lib/read-timeout';

afterEach(() => vi.useRealTimers());
describe('Saved jobs read deadline', () => {
  it('returns successful reads and clears the timer', async () => {
    vi.useFakeTimers();
    await expect(withReadTimeout(Promise.resolve({ jobs: [1] }))).resolves.toEqual({ jobs: [1] });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('preserves permission errors rather than reporting an empty catalog', async () => {
    await expect(withReadTimeout(Promise.reject(new Error('permission-denied')))).rejects.toThrow('permission-denied');
  });
  it('ends an indefinitely pending read and allows a fresh retry', async () => {
    vi.useFakeTimers();
    const result = expect(withReadTimeout(new Promise(() => {}))).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(15000);
    await result;
    await expect(withReadTimeout(Promise.resolve('retried'))).resolves.toBe('retried');
    expect(vi.getTimerCount()).toBe(0);
  });
});
