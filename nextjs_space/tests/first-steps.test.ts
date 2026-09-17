import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { firstStepsProgress, readFirstSteps, updateFirstSteps } from '../lib/first-steps';
const values = new Map<string, string>();
beforeEach(() => {
  values.clear();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());
it('isolates account preferences and preserves progress when hiding and resuming', () => {
  updateFirstSteps('a', { symbol: 'THYAO.IS', reviewed: true });
  updateFirstSteps('a', { dismissed: true });
  expect(readFirstSteps('b')).toEqual({ symbol: undefined, reviewed: false, dismissed: false });
  updateFirstSteps('a', { dismissed: false });
  expect(firstStepsProgress(readFirstSteps('a'), 1)).toEqual([true, true, true]);
  expect(readFirstSteps('a').dismissed).toBe(false);
});
it('requires an actual buy count even if browser review state says complete', () => {
  expect(firstStepsProgress({ reviewed: true }, 0)).toEqual([false, false, false]);
  expect(firstStepsProgress({}, 1)).toEqual([true, true, false]);
  expect(firstStepsProgress({ symbol: 'BTC-USD', reviewed: true }, NaN)).toEqual([true, false, false]);
});
it('rejects unsafe paths and tolerates malformed or unavailable storage', () => {
  updateFirstSteps('a', { symbol: '../../login' });
  expect(readFirstSteps('a').symbol).toBeUndefined();
  values.set('borsabi-first-steps-v1:a', '{');
  expect(readFirstSteps('a')).toEqual({});
  vi.stubGlobal('localStorage', { getItem: () => { throw Error(); }, setItem: () => { throw Error(); } });
  expect(() => updateFirstSteps('a', { dismissed: true })).not.toThrow();
});
