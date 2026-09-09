import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: { replaySession: { findFirst: vi.fn(), updateMany: vi.fn() } } }));
vi.mock('../lib/yahoo-finance', () => ({ cachedChart: vi.fn() }));
import { prisma } from '../lib/db';
import { getServerSession } from 'next-auth';
import { createReplay } from '../lib/replay';
import { GET, PATCH } from '../app/api/replay/route';
const bars = Array.from({ length: 40 }, (_, i) => ({ time: new Date(1700000000000 + i * 300000).toISOString(), open: 100, high: 101, low: 99, close: 100, volume: 1 }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } }); });
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
