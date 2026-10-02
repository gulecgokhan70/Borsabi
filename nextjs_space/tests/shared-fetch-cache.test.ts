import { afterEach, expect, it, vi } from 'vitest';
import { SharedFetchCache } from '../lib/shared-fetch-cache';
afterEach(() => vi.useRealTimers());
it('coalesces twenty concurrent consumers into one upstream request', async () => {
  const cache = new SharedFetchCache(10, 1000);
  const load = vi.fn(async () => ({ price: 100, asOf: 'original' }));
  const values = await Promise.all(Array.from({ length: 20 }, () => cache.get('BTC', load)));
  expect(load).toHaveBeenCalledTimes(1); expect(values.every(value => value === values[0])).toBe(true);
  expect(cache.pendingCount).toBe(0);
});
it('starts TTL at completion and keeps original values/timestamps when a refresh fails', async () => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  const cache = new SharedFetchCache(5, 1000);
  await cache.get('BTC', async () => { vi.setSystemTime(2000); return { price: 100, asOf: 0 }; });
  const failed = vi.fn(async () => { throw new Error('offline'); });
  vi.setSystemTime(2500); expect(await cache.get('BTC', failed)).toEqual({ price: 100, asOf: 0 }); expect(failed).not.toHaveBeenCalled();
  vi.setSystemTime(3001); expect(await cache.get('BTC', failed)).toEqual({ price: 100, asOf: 0 }); expect(failed).toHaveBeenCalledTimes(1);
  const fresh = vi.fn(async () => ({ price: 110, asOf: 3002 }));
  expect(await cache.get('BTC', fresh)).toEqual({ price: 110, asOf: 3002 });
});
it('evicts least-recently-used entries and bounds in-flight work', async () => {
  const cache = new SharedFetchCache(2, 1000), load = vi.fn(async () => 1);
  await cache.get('a', load); await cache.get('b', load); await cache.get('a', load); await cache.get('c', load);
  expect(cache.size).toBe(2); await cache.get('b', load); expect(load).toHaveBeenCalledTimes(4);
  let finish!: (value: number) => void;
  const bounded = new SharedFetchCache(1, 1000);
  const pending = bounded.get('a', () => new Promise<number>(resolve => { finish = resolve; }));
  await Promise.resolve(); await expect(bounded.get('b', async () => 2)).rejects.toThrow('sınırına'); finish(1); await pending;
  expect(bounded.pendingCount).toBe(0);
});
it('does not cache errors without an existing value', async () => {
  const cache = new SharedFetchCache(5, 1000);
  await expect(cache.get('a', async () => { throw new Error('failure'); })).rejects.toThrow('failure');
  expect(await cache.get('a', async () => 2)).toBe(2);
});
