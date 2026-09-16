import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/news-feed', () => ({ getAllNews: vi.fn() }));
vi.mock('../lib/request-limit', () => ({ takeRequestSlot: vi.fn() }));
import { getServerSession } from 'next-auth';
import { getAllNews } from '../lib/news-feed';
import { takeRequestSlot } from '../lib/request-limit';
import { GET } from '../app/api/event-radar/route';
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'radar-user' } });
  vi.mocked(getAllNews).mockResolvedValue([]);
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: true, retryAfter: 0 });
});
it('does not load feeds for anonymous or throttled requests', async () => {
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'radar-user' } });
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: false, retryAfter: 20 });
  const response = await GET();
  expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('20');
  expect(getAllNews).not.toHaveBeenCalled();
});
it('reports insufficient data without a fabricated forecast, and hides internal errors', async () => {
  const response = await GET();
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(await response.json()).toMatchObject({ status: 'insufficient', events: [] });
  vi.mocked(getAllNews).mockRejectedValue(new Error('secret configuration'));
  const failed = await GET(); expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain('secret configuration');
});
