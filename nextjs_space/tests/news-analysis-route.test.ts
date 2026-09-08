import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/news-analysis', () => ({ getNewsImpact: vi.fn() }));
vi.mock('../lib/request-limit', () => ({ takeRequestSlot: vi.fn() }));
import { getServerSession } from 'next-auth';
import { getNewsImpact } from '../lib/news-analysis';
import { takeRequestSlot } from '../lib/request-limit';
import { GET } from '../app/api/news-analysis/route';
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'test-user' } });
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: true, retryAfter: 0 });
  vi.mocked(getNewsImpact).mockResolvedValue(null);
});

it('prevents anonymous visitors from consuming the analysis quota', async () => {
  for (const session of [null, { user: {} }]) {
    vi.mocked(getServerSession).mockResolvedValue(session);
    expect((await GET()).status).toBe(401);
  }
  expect(getNewsImpact).not.toHaveBeenCalled();
  expect(takeRequestSlot).not.toHaveBeenCalled();
});

it('allows an authenticated reader and applies a user-specific limit', async () => {
  expect((await GET()).status).toBe(200);
  expect(takeRequestSlot).toHaveBeenCalledWith('news:test-user', 10, 60_000);
  expect(getNewsImpact).toHaveBeenCalledTimes(1);
});

it('returns Retry-After without starting analysis when the limit is reached', async () => {
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: false, retryAfter: 42 });
  const response = await GET();
  expect(response.status).toBe(429);
  expect(response.headers.get('retry-after')).toBe('42');
  expect(getNewsImpact).not.toHaveBeenCalled();
});

it('does not expose internal errors in the response', async () => {
  vi.mocked(getNewsImpact).mockRejectedValue(new Error('private provider detail'));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('private provider detail');
});
