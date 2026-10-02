import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readResume, updateResume, parseCourseProgress, courseProgressKey } from '../lib/resume';
const values = new Map<string, string>();
beforeEach(() => { values.clear(); vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }); });
afterEach(() => vi.unstubAllGlobals());
it('isolates account history and preserves it when hiding and restoring the card', () => {
  updateResume('a', { stock: { href: '/stock/THYAO.IS', title: 'THYAO', at: 1000 } });
  updateResume('a', { hidden: true });
  expect(readResume('b').stock).toBeUndefined();
  updateResume('a', { hidden: false });
  expect(readResume('a').stock?.href).toBe('/stock/THYAO.IS');
  expect(readResume('a').hidden).toBe(false);
  expect(courseProgressKey('a', 'b')).not.toBe(courseProgressKey('b', 'b'));
});
it('rejects external, unknown and malformed destinations from stored data', () => {
  for (const href of ['https://evil.test', '/stock/NOTAREALASSET', '/stock/%', '/stock/../../login']) {
    updateResume('a', { stock: { href, title: 'invalid', at: 1 } });
    expect(readResume('a').stock).toBeUndefined();
  }
  values.set('borsabi-resume-v1:a', '{'); expect(readResume('a')).toEqual({});
});
it('restores valid lesson progress without out-of-range indices or fake completion', () => {
  expect(parseCourseProgress('{"active":2,"completed":[0,1,1,99,-1,"2"]}', 3)).toEqual({ active: 2, completed: [0,1] });
  expect(parseCourseProgress('{"active":99}', 3)).toEqual({ active: 0, completed: [] });
  expect(parseCourseProgress('bad', 3)).toEqual({ active: 0, completed: [] });
});
