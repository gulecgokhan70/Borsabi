import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: {
  priceAlert: { findMany: vi.fn(), updateMany: vi.fn() },
  position: { findMany: vi.fn(), updateMany: vi.fn() },
} }));
vi.mock('../lib/market-quotes', () => ({ getMarketQuotes: vi.fn(), normalizeMarketSymbol: (s: string) => s === 'THYAO' ? 'THYAO.IS' : s }));
import { getServerSession } from 'next-auth';
import { prisma } from '../lib/db';
import { getMarketQuotes } from '../lib/market-quotes';
import { GET } from '../app/api/alerts/check/route';
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  vi.mocked(prisma.priceAlert.findMany).mockResolvedValue([]);
  vi.mocked(prisma.position.findMany).mockResolvedValue([]);
  vi.mocked(prisma.priceAlert.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.position.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(getMarketQuotes).mockResolvedValue([{ symbol: 'THYAO.IS', price: 100 } as any]);
});
it('checks trailing stops even when there are no price alerts', async () => {
  vi.mocked(prisma.position.findMany).mockResolvedValue([{
    id: 'position', symbol: 'THYAO', name: 'THY', entryPrice: 100, currentPrice: 110,
    trailingStopPercent: 5, trailingStopHighest: 110, updatedAt: new Date(),
  } as any]);
  const body = await (await GET()).json();
  expect(getMarketQuotes).toHaveBeenCalledWith(['THYAO.IS']);
  expect(body.trailingAlerts).toHaveLength(1);
  expect(body.trailingAlerts[0].stopLevel).toBe(104.5);
});
it('claims a triggered alert and releases the active slot', async () => {
  vi.mocked(prisma.priceAlert.findMany).mockResolvedValue([{
    id: 'alert', symbol: 'THYAO.IS', condition: 'above', targetPrice: 90,
  } as any]);
  expect((await (await GET()).json()).triggered).toHaveLength(1);
  expect(prisma.priceAlert.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 'alert', userId: 'owner', active: true, triggered: false },
    data: expect.objectContaining({ active: false, triggered: true }),
  }));
});
it('does not duplicate a notification already claimed by another poll', async () => {
  vi.mocked(prisma.priceAlert.findMany).mockResolvedValue([{ id: 'alert', symbol: 'THYAO.IS', condition: 'above', targetPrice: 90 } as any]);
  vi.mocked(prisma.priceAlert.updateMany).mockResolvedValue({ count: 0 });
  expect((await (await GET()).json()).triggered).toEqual([]);
});
it('does not repeat a trailing notification while price stays below the stop', async () => {
  vi.mocked(prisma.position.findMany).mockResolvedValue([{
    id: 'position', symbol: 'THYAO.IS', entryPrice: 100, currentPrice: 100,
    trailingStopPercent: 5, trailingStopHighest: 110, updatedAt: new Date(),
  } as any]);
  expect((await (await GET()).json()).trailingAlerts).toEqual([]);
});
it('does not write zero or invalid quotes to positions', async () => {
  vi.mocked(prisma.position.findMany).mockResolvedValue([{ id: 'position', symbol: 'THYAO.IS', trailingStopPercent: 5 } as any]);
  vi.mocked(getMarketQuotes).mockResolvedValue([{ symbol: 'THYAO.IS', price: 0, error: true } as any]);
  await GET();
  expect(prisma.position.updateMany).not.toHaveBeenCalled();
});
