import { afterEach, expect, it, vi } from 'vitest';
import { startVisiblePolling } from '../lib/visible-poll';
afterEach(() => vi.useRealTimers());
function environment() {
  return { document: Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState }), window: new EventTarget(), navigator: { onLine: true } };
}
it('makes zero background/offline requests and resumes when the user returns', async () => {
  vi.useFakeTimers();
  const env = environment(), task = vi.fn(async () => undefined);
  const stop = startVisiblePolling(task, 1000, env);
  await vi.advanceTimersByTimeAsync(0); expect(task).toHaveBeenCalledTimes(1);
  env.document.visibilityState = 'hidden'; env.document.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(60_000); expect(task).toHaveBeenCalledTimes(1);
  env.document.visibilityState = 'visible'; env.document.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(0); expect(task).toHaveBeenCalledTimes(2);
  env.navigator.onLine = false; env.window.dispatchEvent(new Event('offline'));
  await vi.advanceTimersByTimeAsync(60_000); expect(task).toHaveBeenCalledTimes(2);
  env.navigator.onLine = true; env.window.dispatchEvent(new Event('online'));
  await vi.advanceTimersByTimeAsync(0); expect(task).toHaveBeenCalledTimes(3);
  stop(); await vi.advanceTimersByTimeAsync(60_000);
  env.window.dispatchEvent(new Event('online')); expect(task).toHaveBeenCalledTimes(3);
});
it('does not overlap slow requests, aborts on background and cleans up an active request', async () => {
  vi.useFakeTimers(); const env = environment(); let finish!: () => void;
  const task = vi.fn((_signal: AbortSignal) => new Promise<void>(resolve => { finish = resolve; }));
  const stop = startVisiblePolling(task, 1000, env);
  await vi.advanceTimersByTimeAsync(20_000); expect(task).toHaveBeenCalledTimes(1);
  env.document.visibilityState = 'hidden'; env.document.dispatchEvent(new Event('visibilitychange'));
  expect(task.mock.calls[0][0].aborted).toBe(true);
  finish(); await vi.advanceTimersByTimeAsync(20_000); expect(task).toHaveBeenCalledTimes(1);
  env.document.visibilityState = 'visible'; env.document.dispatchEvent(new Event('visibilitychange'));
  expect(task).toHaveBeenCalledTimes(2); stop(); expect(task.mock.calls[1][0].aborted).toBe(true);
  finish(); await vi.advanceTimersByTimeAsync(20_000); expect(task).toHaveBeenCalledTimes(2);
});
it('recovers after a failed request without polling while initially hidden', async () => {
  vi.useFakeTimers(); const env = environment(); env.document.visibilityState = 'hidden';
  const task = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  const stop = startVisiblePolling(task, 1000, env);
  await vi.advanceTimersByTimeAsync(20_000); expect(task).not.toHaveBeenCalled();
  env.document.visibilityState = 'visible'; env.document.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(1000); expect(task).toHaveBeenCalledTimes(2); stop();
});
