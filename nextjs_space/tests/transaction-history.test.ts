import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: { $transaction: vi.fn(), $queryRaw: vi.fn(), transaction: { findMany: vi.fn(), count: vi.fn() } } }));
import { getServerSession } from 'next-auth';
import { prisma } from '../lib/db';
import { GET } from '../app/api/transactions/route';
import { GET as learning } from '../app/api/learning-summary/route';
const summary = { total: 120, totalTrades: 50, winCount: 20, buyCount: 70, sellCount: 50, withNote: 10, buysWithStop: 20, totalCommission: 10 };
beforeEach(() => {
  vi.resetAllMocks(); vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
  vi.mocked(prisma.$queryRaw).mockResolvedValue([summary]);
  vi.mocked(prisma.transaction.count).mockResolvedValue(50);
  vi.mocked(prisma.transaction.findMany).mockResolvedValue([{ id: 't26', marketType: 'CRYPTO', fxRate: 30 }] as any);
});
it('loads only the requested page while computing stats over the complete account ledger', async () => {
  const response = await GET(new NextRequest('http://localhost/api/transactions?page=2&type=SELL'));
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toMatchObject({ total: 50, page: 2, limit: 25, hasMore: false, stats: { total: 120, winRate: 40 }, transactions: [{ id: 't26', currency: 'USD', legacyCurrency: false }] });
  expect(prisma.transaction.findMany).toHaveBeenCalledTimes(1);
  expect(prisma.transaction.findMany).toHaveBeenCalledWith({ where: { userId: 'owner', type: 'SELL' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: 25, take: 25 });
  const sql = vi.mocked(prisma.$queryRaw).mock.calls[0][0] as any;
  expect(sql.values).toEqual(['owner']); expect(sql.sql).not.toContain('owner');
});
it('rejects oversized pages and invalid filters without reading transactions', async () => {
  for (const query of ['limit=101', 'limit=-1', 'page=1.5', 'page=100001', 'type=invalid']) expect((await GET(new NextRequest(`http://localhost/api/transactions?${query}`))).status).toBe(400);
  vi.mocked(getServerSession).mockResolvedValue(null); expect((await GET(new NextRequest('http://localhost/api/transactions'))).status).toBe(401);
  expect(prisma.transaction.findMany).not.toHaveBeenCalled();
});
it('binds the rolling learning window and identity as SQL parameters', async () => {
  const response = await learning(new NextRequest('http://localhost/api/learning-summary?days=30'));
  const body = await response.json(); expect(body.days).toBe(30);
  expect(new Date(body.end).getTime() - new Date(body.start).getTime()).toBe(30 * 86400000);
  const sql = vi.mocked(prisma.$queryRaw).mock.calls[0][0] as any;
  expect(sql.values).toEqual(['owner', new Date(body.start), new Date(body.end)]);
  expect(body.suggestions.length).toBeGreaterThan(0);
  expect((await learning(new NextRequest('http://localhost/api/learning-summary?days=365'))).status).toBe(400);
});
