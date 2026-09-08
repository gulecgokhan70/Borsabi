import { beforeEach, expect, it } from 'vitest';
import { signupClientKey, takeRequestSlot } from '../lib/request-limit';
beforeEach(() => { (globalThis as any).borsabiRequestLimits.clear(); });

it('blocks excess attempts and allows requests again when the window expires', () => {
  for (let i = 0; i < 5; i++) expect(takeRequestSlot('test', 5, 60_000, 1000).allowed).toBe(true);
  expect(takeRequestSlot('test', 5, 60_000, 2000)).toEqual({ allowed: false, retryAfter: 59 });
  expect(takeRequestSlot('other', 5, 60_000, 2000).allowed).toBe(true);
  expect(takeRequestSlot('test', 5, 60_000, 61_000).allowed).toBe(true);
});

it('uses the proxy-appended address and ignores spoofable client prefixes', () => {
  const key = signupClientKey(new Headers({ 'x-forwarded-for': '198.51.100.23' }));
  expect(signupClientKey(new Headers({ 'x-forwarded-for': '1.1.1.1, 198.51.100.23' }))).toBe(key);
  expect(signupClientKey(new Headers({ 'x-forwarded-for': '2.2.2.2, 198.51.100.23' }))).toBe(key);
  expect(key).not.toContain('198.51.100.23');
  expect(signupClientKey(new Headers({ 'x-forwarded-for': 'invalid' }))).toBe(signupClientKey(new Headers()));
});

it('caps limiter storage and recovers capacity after expired entries are removed', () => {
  for (let i = 0; i < 10_000; i++) takeRequestSlot(`id:${i}`, 1, 60_000, 0);
  expect(takeRequestSlot('extra', 1, 60_000, 0).allowed).toBe(false);
  expect((globalThis as any).borsabiRequestLimits.size).toBe(10_000);
  expect(takeRequestSlot('extra', 1, 60_000, 60_000).allowed).toBe(true);
});
