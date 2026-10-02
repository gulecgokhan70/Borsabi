import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: { user: { findUnique: vi.fn() }, replaySession: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() } } }));
vi.mock('../lib/yahoo-finance', () => ({ cachedChart: vi.fn() }));
import { cachedChart } from '../lib/yahoo-finance';
import { prisma } from '../lib/db';
import { getServerSession } from 'next-auth';
import { createReplay, applyReplay, replayDate } from '../lib/replay';
import { GET, PATCH, POST } from '../app/api/replay/route';
const bars = Array.from({ length: 40 }, (_, i) => ({ time: new Date(1700000000000 + i * 300000).toISOString(), open: 100, high: 101, low: 99, close: 100, volume: 1 }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(prisma.user.findUnique).mockResolvedValue({ commissionRate: 0.001 } as any); vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } }); });
it('loads only the owner session and omits unseen candles from the HTTP response', async () => {
  vi.mocked(prisma.replaySession.findFirst).mockResolvedValue({ id: 'replay1', version: 0, state: createReplay('BTC-USD', bars) } as any);
  const r = await GET(new NextRequest('http://localhost/api/replay?id=replay1'));
  expect(prisma.replaySession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'replay1', userId: 'owner' } }));
  const data = await r.json(); expect(data.bars).toHaveLength(30); expect(JSON.stringify(data)).not.toContain(bars[39].time);
});
it('rejects unauthenticated access and another users session', async () => {
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await GET(new NextRequest('http://localhost/api/replay'))).status).toBe(401);
  expect(prisma.replaySession.findFirst).not.toHaveBeenCalled();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  vi.mocked(prisma.replaySession.findFirst).mockResolvedValue(null);
  const req = new NextRequest('http://localhost/api/replay', { method: 'PATCH', body: JSON.stringify({ id: 'others', version: 0, action: 'BUY', quantity: 1 }) });
  expect((await PATCH(req)).status).toBe(404); expect(prisma.replaySession.updateMany).not.toHaveBeenCalled();
});
it('a repeated or concurrent action cannot spend twice', async () => {
  vi.mocked(prisma.replaySession.findFirst).mockResolvedValue({ id: 'replay1', version: 1, state: createReplay('BTC-USD', bars) } as any);
  const request = (version: number) => new NextRequest('http://localhost/api/replay', { method: 'PATCH', body: JSON.stringify({ id: 'replay1', version, action: 'BUY', quantity: 1 }) });
  expect((await PATCH(request(0))).status).toBe(409); expect(prisma.replaySession.updateMany).not.toHaveBeenCalled();
  vi.mocked(prisma.replaySession.updateMany).mockResolvedValue({ count: 0 });
  expect((await PATCH(request(1))).status).toBe(409);
  expect(prisma.replaySession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'replay1', userId: 'owner', version: 1 } }));
});

it('uses current profile commission for an existing session and never rewrites its earlier fees', async () => {
  const old = applyReplay(createReplay('BTC-USD', bars), { action: 'BUY', quantity: 1, note: '' });
  delete old.commissionRate;
  vi.mocked(prisma.replaySession.findFirst).mockResolvedValue({ id: 'r', version: 1, state: old } as any);
  vi.mocked(prisma.replaySession.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ commissionRate: 0 } as any);
  const response = await PATCH(new NextRequest('http://localhost/api/replay', { method: 'PATCH', body: JSON.stringify({ id: 'r', version: 1, action: 'SELL', quantity: 1, commissionRate: .01 }) }));
  const data = await response.json();
  expect(response.status).toBe(200); expect(data.commissionRate).toBe(0);
  expect(data.trades.map((t: any) => t.commission)).toEqual([.2, 0]);
  expect(data.cash).toBeCloseTo(9999.8);
  expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'owner' }, select: { commissionRate: true } });
});
it('starts the selected day at the saved profile rate and rejects provider data from a different day', async () => {
  const day = replayDate(Date.now() - 86400000);
  const start = new Date(`${day}T09:00:00+03:00`).getTime();
  const quotes = bars.map((b, i) => ({ ...b, date: new Date(start + i * 300000) }));
  vi.mocked(cachedChart).mockResolvedValue({ meta: { currency: 'TRY' }, quotes });
  vi.mocked(prisma.replaySession.create).mockImplementation((( { data }: any) => Promise.resolve({ id: 'r', version: 0, ...data })) as any);
  const request = () => new NextRequest('http://localhost/api/replay', { method: 'POST', body: JSON.stringify({ symbol: 'THYAO', date: day, commissionRate: .01 }) });
  const response = await POST(request()); const data = await response.json();
  expect(response.status).toBe(200); expect(data.practiceDate).toBe(day); expect(data.commissionRate).toBe(.001);
  expect(data.bars).toHaveLength(30);
  vi.mocked(cachedChart).mockResolvedValue({ meta: { currency: 'TRY' }, quotes: quotes.map(q => ({ ...q, date: new Date(q.date.getTime() - 86400000) })) });
  vi.mocked(prisma.replaySession.create).mockClear();
  expect((await POST(request())).status).toBe(503);
  expect(prisma.replaySession.create).not.toHaveBeenCalled();
});
