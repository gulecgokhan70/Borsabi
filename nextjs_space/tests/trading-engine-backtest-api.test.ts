import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock('../lib/request-limit', () => ({ takeRequestSlot: vi.fn() }));
vi.mock('../lib/trading-engine/service', () => ({ engineHistory: vi.fn(), cryptoContextAt: vi.fn() }));
vi.mock('../lib/trading-engine/backtest-engine', () => ({ runEngineBacktest: vi.fn() }));
vi.mock('../lib/trading-engine/walk-forward', () => ({ walkForward: vi.fn() }));
import { getServerSession } from 'next-auth';
import { prisma } from '../lib/db';
import { engineHistory } from '../lib/trading-engine/service';
import { runEngineBacktest } from '../lib/trading-engine/backtest-engine';
import { takeRequestSlot } from '../lib/request-limit';
import { POST } from '../app/api/trading-engine/backtest/route';
const request = (input: Record<string, unknown> = {}, origin?: string) => POST(new NextRequest('http://localhost/api/trading-engine/backtest', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { origin } : {}) },
  body: JSON.stringify({ symbol: 'THYAO.IS', initialCapital: 100000, ...input }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ tier: 'pro', commissionRate: 0.002 } as any);
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: true, retryAfter: 0 });
  vi.mocked(engineHistory).mockResolvedValue(Array.from({ length: 240 }, (_, n) => ({ timestamp: n, closedAt: n + 1, open: 100, high: 101, low: 99, close: 100, volume: 100 })));
  vi.mocked(runEngineBacktest).mockReturnValue({ summary: {}, trades: [], timeline: [], equity: [], assumptions: [], currency: 'TRY' } as any);
});
it('authentication and Pro checks precede expensive upstream fetches', async () => {
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await request()).status).toBe(401);
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ tier: 'free', commissionRate: 0.002 } as any);
  expect((await request()).status).toBe(403);
  expect(engineHistory).not.toHaveBeenCalled();
});
it('rejects unsupported symbols, forged commissions, invalid capital and cross-site mutations', async () => {
  for (const body of [{ symbol: 'evil' }, { commissionRate: 0 }, { initialCapital: -1 }, { timeframe: '5m' }])
    expect((await request(body)).status).toBe(400);
  expect((await request({}, 'https://evil.test')).status).toBe(403);
  expect(engineHistory).not.toHaveBeenCalled();
});
it('loads commission only from authenticated profile and never changes the portfolio', async () => {
  const response = await request();
  expect(response.status).toBe(200);
  expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'owner' }, select: { tier: true, commissionRate: true } });
  expect(runEngineBacktest).toHaveBeenCalledWith(expect.objectContaining({ costs: { commission: 0.002, slippage: 0.001, spread: 0.001 }, initialCapital: 100000 }));
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it('blocks invalid profile commission, insufficient data and excessive requests', async () => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ tier: 'pro', commissionRate: -1 } as any);
  expect((await request()).status).toBe(503);
  expect(engineHistory).not.toHaveBeenCalled();
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ tier: 'pro', commissionRate: 0.002 } as any);
  vi.mocked(engineHistory).mockResolvedValue([]);
  expect((await request()).status).toBe(422);
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: false, retryAfter: 60 });
  expect((await request()).status).toBe(429);
  expect(runEngineBacktest).not.toHaveBeenCalled();
});
