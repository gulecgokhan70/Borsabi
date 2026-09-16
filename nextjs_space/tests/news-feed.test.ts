import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); delete (globalThis as any).borsabiNewsFeed; });
it('shares concurrent feed work and marks fallback dates as unverified', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('<rss><item><title>Petrol yükseldi</title><link>https://dunya.com/a</link><pubDate>invalid</pubDate></item></rss>'));
  // Each provider needs its own consumable response body.
  fetcher.mockImplementation(async () => new Response('<rss><item><title>Petrol yükseldi</title><link>https://dunya.com/a</link><pubDate>invalid</pubDate></item></rss>'));
  vi.stubGlobal('fetch', fetcher);
  const { getAllNews } = await import('../lib/news-feed');
  const [first, second] = await Promise.all([getAllNews(), getAllNews()]);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(first).toEqual(second); expect(first).toHaveLength(1);
  expect(first[0].dateVerified).toBe(false);
  await getAllNews(); expect(fetcher).toHaveBeenCalledTimes(3);
});
