import { NextRequest } from 'next/server';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: { $transaction: vi.fn(), user: { findUnique: vi.fn() }, position: { findMany: vi.fn() }, transaction: { aggregate: vi.fn(), count: vi.fn(), findMany: vi.fn() } } }));
vi.mock('../lib/position-valuation', () => ({ valuePositions: vi.fn() }));
import { getServerSession } from 'next-auth';
import { prisma } from '../lib/db';
import { valuePositions } from '../lib/position-valuation';
vi.mock('../lib/bot-lab/portfolio-view', () => ({ readBotPortfolio: vi.fn(async () => ({ positions: [], ledger: [], bots: [], capitalChanges: [] })) }));
import { GET } from '../app/api/portfolio/route';
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(prisma));
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ balance: 99998.8, initialBalance: 100000, commissionRate: 0 } as any);
  vi.mocked(prisma.position.findMany).mockResolvedValue([]);
  vi.mocked(valuePositions).mockResolvedValue([]);
  vi.mocked(prisma.transaction.aggregate).mockResolvedValue({ _sum: { pnl: -1.2 }, _count: { _all: 1 } } as any);
  vi.mocked(prisma.transaction.count).mockResolvedValue(0);
});
it('returns only the authenticated owner totals without reading the full ledger or closed positions', async () => {
  const response = await GET(new NextRequest('https://borsabi.com/api/portfolio?summary=1&userId=other'));
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  expect(await response.json()).toMatchObject({ accountId: 'owner', balance: 99998.8, commissionRate: 0, realizedPnl: -1.2, totalTrades: 1, winRate: 0 });
  expect(prisma.transaction.findMany).not.toHaveBeenCalled();
  expect(prisma.position.findMany).toHaveBeenCalledTimes(1);
  expect(prisma.transaction.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner', type: 'SELL', pnl: { not: null } } }));
});
it('still returns a complete breakdown on the portfolio page', async () => {
  vi.mocked(prisma.transaction.findMany).mockResolvedValue([
    { type: 'BUY', symbol: 'THYAO.IS', quantity: 1, total: 300.5, commission: .6, pnl: null, pricePnlTry: null, fxPnlTry: null, createdAt: new Date() },
    { type: 'SELL', symbol: 'THYAO.IS', quantity: 1, total: 300.5, commission: .6, pnl: -1.2, pricePnlTry: 0, fxPnlTry: 0, createdAt: new Date() },
  ] as any);
  const data = await (await GET(new NextRequest('https://borsabi.com/api/portfolio'))).json();
  expect(data.explanation.commissions).toBe(1.2);
  expect(data.explanation.netChange).toBeCloseTo(-1.2);
  expect(data.equityCurve).toBeDefined();
  expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
});
it('does not expose cached account data to an unauthenticated request', async () => {
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await GET(new NextRequest('https://borsabi.com/api/portfolio?summary=1'))).status).toBe(401);
  expect(prisma.user.findUnique).not.toHaveBeenCalled();
});
