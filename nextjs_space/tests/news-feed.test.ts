import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); delete (globalThis as any).borsabiNewsFeed; });
it('shares concurrent feed work and marks fallback dates as unverified', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('<rss><item><title>Petrol yükseldi</title><link>https://dunya.com/a</link><pubDate>invalid</pubDate></item></rss>'));
  // Each provider needs its own consumable response body.
  fetcher.mockImplementation(async () => new Response('<rss><item><title>Petrol yükseldi</title><link>https://dunya.com/a</link><pubDate>invalid</pubDate></item></rss>'));
  vi.stubGlobal('fetch', fetcher);
  const { getAllNews } = await import('../lib/news-feed');
  const [first, second] = await Promise.all([getAllNews(), getAllNews()]);
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(first).toEqual(second); expect(first).toHaveLength(1);
  expect(first[0].dateVerified).toBe(false);
  await getAllNews(); expect(fetcher).toHaveBeenCalledTimes(4);
});
it('reports broken feeds separately and preserves original article dates through failed refreshes', async () => {
  let clock = Date.parse('2026-09-16T10:00:00Z');
  const now = vi.spyOn(Date, 'now').mockImplementation(() => clock);
  let fail = false;
  const fetcher = vi.fn(async (url: string) => {
    if (fail || !url.includes('bloomberght')) throw new Error('offline');
    return new Response('<rss><item><title>Ekonomik önlem paketi</title><link>https://www.bloomberght.com/haber</link><pubDate>Wed, 16 Sep 2026 09:00:00 +0000</pubDate></item></rss>');
  });
  vi.stubGlobal('fetch', fetcher);
  const { getAllNews, newsSourceStatus } = await import('../lib/news-feed');
  const first = await getAllNews();
  expect(newsSourceStatus().filter(s => s.state === 'error')).toHaveLength(3);
  fail = true; clock += 61_000;
  const second = await getAllNews();
  expect(fetcher).toHaveBeenCalledTimes(8);
  expect(second).toEqual(first);
  expect(second[0].date).toBe('2026-09-16T09:00:00.000Z');
  expect(newsSourceStatus().every(s => s.state === 'error')).toBe(true);
  now.mockRestore();
});
it('retries an empty feed after one minute instead of caching absence for ten minutes', async () => {
  let clock = Date.parse('2026-09-16T10:00:00Z');
  const now = vi.spyOn(Date, 'now').mockImplementation(() => clock);
  const fetcher = vi.fn(async () => new Response('<rss><channel /></rss>'));
  vi.stubGlobal('fetch', fetcher);
  const { getAllNews, newsSourceStatus } = await import('../lib/news-feed');
  await getAllNews(); clock += 61_000; await getAllNews();
  expect(fetcher).toHaveBeenCalledTimes(8);
  expect(newsSourceStatus().every(s => s.state === 'empty')).toBe(true);
  now.mockRestore();
});
