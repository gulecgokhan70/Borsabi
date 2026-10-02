import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock('../lib/yahoo-finance', () => ({ cachedChart: vi.fn() }));
import { prisma } from '../lib/db';
import { getServerSession } from 'next-auth';
import { cachedChart } from '../lib/yahoo-finance';
import { POST } from '../app/api/backtest/route';
const req = () => new NextRequest('http://localhost/api/backtest', { method: 'POST', body: JSON.stringify({ symbol: 'THYAO.IS', strategy: 'macd-crossover', period: '1y', stopLoss: 3, takeProfit: 3, commissionRate: .01, userId: 'other' }) });
beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  vi.mocked(cachedChart).mockResolvedValue({ quotes: Array.from({ length: 200 }, (_, i) => ({ date: new Date(1700000000000 + i * 86400000), close: 100 + Math.sin(i / 6) * 20, high: 125, low: 75 })) });
});
it('requires authentication before reading a profile or market data', async () => {
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await POST(req())).status).toBe(401);
  expect(cachedChart).not.toHaveBeenCalled(); expect(prisma.user.findUnique).not.toHaveBeenCalled();
});
it('uses the authenticated profile including zero, ignoring a forged client rate', async () => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ commissionRate: 0 } as any);
  const free = await (await POST(req())).json();
  expect(free.commissionRate).toBe(0); expect(free.summary.totalTrades).toBeGreaterThan(0); expect(free.summary.totalCommission).toBe(0);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ commissionRate: .001 } as any);
  const charged = await (await POST(req())).json();
  expect(charged.commissionRate).toBe(.001); expect(charged.summary.totalCommission).toBeGreaterThan(0);
  expect(charged.summary.finalCapital).toBeLessThan(free.summary.finalCapital);
  expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'owner' }, select: { commissionRate: true } });
});
