import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/trading-engine/service', () => ({ marketDecision: vi.fn() }));
vi.mock('../lib/request-limit', () => ({ takeRequestSlot: vi.fn() }));
import { getServerSession } from 'next-auth';
import { marketDecision } from '../lib/trading-engine/service';
import { takeRequestSlot } from '../lib/request-limit';
import { GET } from '../app/api/trading-engine/route';
const request = (query = 'symbol=THYAO.IS&timeframe=1d') => GET(new Request('http://localhost/api/trading-engine?' + query));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: true, retryAfter: 0 });
  vi.mocked(marketDecision).mockResolvedValue({ signal: { direction: 'NONE' } } as any);
});
it('requires login before upstream lookup', async () => {
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await request()).status).toBe(401);
  expect(marketDecision).not.toHaveBeenCalled();
});
it('validates catalog symbols and supported intervals', async () => {
  expect((await request('symbol=arbitrary&timeframe=1d')).status).toBe(400);
  expect((await request('symbol=THYAO.IS&timeframe=5m')).status).toBe(400);
  expect(marketDecision).not.toHaveBeenCalled();
});
it('uses authenticated limiter key and does not cache results publicly', async () => {
  const response = await request('symbol=BTC-USD&timeframe=15m&userId=other');
  expect(response.status).toBe(200);
  expect(takeRequestSlot).toHaveBeenCalledWith('engine:owner', 12, 60000);
  expect(marketDecision).toHaveBeenCalledWith('BTC-USD', 'CRYPTO', '15m');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect((await response.json()).currency).toBe('USD');
});
it('rate limit and upstream failures are explicit', async () => {
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: false, retryAfter: 60 });
  expect((await request()).status).toBe(429);
  expect(marketDecision).not.toHaveBeenCalled();
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: true, retryAfter: 0 });
  vi.mocked(marketDecision).mockRejectedValue(new Error('provider failure'));
  expect((await request()).status).toBe(503);
});
