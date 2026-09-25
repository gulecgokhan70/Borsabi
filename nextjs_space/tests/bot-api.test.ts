import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: { user: { findUnique: vi.fn() }, paperBot: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() }, paperBotEvent: { create: vi.fn() }, scanCache: { findUnique: vi.fn() }, $transaction: vi.fn() } }));
import { getServerSession } from 'next-auth';
import { prisma } from '../lib/db';
vi.mock('../lib/bot-lab/shared-portfolio', () => ({ serial: async (db: any, fn: any) => db.$transaction(fn), budgetView: vi.fn(async () => ({ configured: true, available: 30000 })) }));
import { GET, POST, PATCH } from '../app/api/bot-lab/route';
import { NextRequest } from 'next/server';
import { autoInitial } from '../lib/bot-lab/auto-engine';
const settings = { mode: 'auto-v2', market: 'BIST', symbols: ['THYAO.IS'], commission: 0.009, friction: 0.001, orderFraction: 0.05, dailyLoss: 0.02, stopLoss: 0.02, takeProfit: 0.04, maxPositions: 3 };
const req = (method: string, data: unknown) => new NextRequest('http://localhost/api/bot-lab', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner', email: 'owner@example.test' } } as any);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'owner', commissionRate: 0 } as any);
  vi.mocked(prisma.paperBot.findMany).mockResolvedValue([]);
  vi.mocked(prisma.scanCache.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.paperBot.create).mockResolvedValue({ id: 'bot' } as any);
  vi.mocked(prisma.paperBot.findFirst).mockResolvedValue({ id: 'bot', userId: 'owner', version: 3, config: settings, state: autoInitial() } as any);
  vi.mocked(prisma.paperBot.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(prisma));
});
it('rejects unauthenticated reads and writes before querying accounts', async () => {
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  expect((await POST(req('POST', settings))).status).toBe(401);
  expect((await PATCH(req('PATCH', { id: 'bot', action: 'start' }))).status).toBe(401);
  expect(prisma.user.findUnique).not.toHaveBeenCalled();
});
it('scopes reads to current user and does not pretend missing worker is online', async () => {
  const res = await GET();
  expect((await res.json()).workerOnline).toBe(false);
  expect(prisma.paperBot.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner' } }));
});
it('creates portfolio-backed paused bot and takes even zero commission from server profile', async () => {
  expect((await POST(req('POST', settings))).status).toBe(201);
  expect(prisma.paperBot.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'owner', symbol: 'AUTO', config: { ...settings, funding: 'portfolio', commission: 0 }, state: expect.objectContaining({ cash: 30000, paused: true, holdings: {} }) }) });
});
it('rejects injected cash and unsupported symbols before creating accounts', async () => {
  for (const body of [{ ...settings, cash: 999999 }, { ...settings, symbols: ['FAKE'] }, { ...settings, maxPositions: 999 }]) expect((await POST(req('POST', body))).status).toBe(400);
  expect(prisma.paperBot.create).not.toHaveBeenCalled();
});
it('cannot control another user bot', async () => {
  vi.mocked(prisma.paperBot.findFirst).mockResolvedValue(null);
  expect((await PATCH(req('PATCH', { id: 'foreign', action: 'stop' }))).status).toBe(404);
  expect(prisma.paperBot.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign', userId: 'owner' } });
  expect(prisma.paperBot.updateMany).not.toHaveBeenCalled();
});
it('pause keeps protective worker active; concurrent change returns conflict without event', async () => {
  expect((await PATCH(req('PATCH', { id: 'bot', action: 'stop' }))).status).toBe(200);
  expect(prisma.paperBot.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'bot', userId: 'owner', version: 3 }, data: expect.objectContaining({ running: true, state: expect.objectContaining({ paused: true }) }) }));
  vi.mocked(prisma.paperBotEvent.create).mockClear();
  vi.mocked(prisma.paperBot.updateMany).mockResolvedValue({ count: 0 });
  expect((await PATCH(req('PATCH', { id: 'bot', action: 'start' }))).status).toBe(409);
  expect(prisma.paperBotEvent.create).not.toHaveBeenCalled();
});
it('closing records a request without fabricating a market execution', async () => {
  expect((await PATCH(req('PATCH', { id: 'bot', action: 'close' }))).status).toBe(200);
  expect(prisma.paperBot.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: expect.objectContaining({ closeRequested: true, cash: 100000 }) }) }));
});

it('rejects cross-origin controls and oversized JSON before state writes', async () => {
 const cross = new NextRequest('http://localhost/api/bot-lab', { method: 'PATCH', headers: { origin: 'https://evil.test', 'content-type': 'application/json' }, body: JSON.stringify({ id: 'bot', action: 'start' }) });
 expect((await PATCH(cross)).status).toBe(403);
 expect((await POST(req('POST', { ...settings, extra: 'x'.repeat(21000) }))).status).toBe(413);
 expect(prisma.paperBot.updateMany).not.toHaveBeenCalled();
 expect(prisma.paperBot.create).not.toHaveBeenCalled();
});

it('expands an existing bot without resetting balance, holdings, pause or protective pending exits', async () => {
  const state = { ...autoInitial(), cash: 95000, paused: true, holdings: { 'THYAO.IS': { quantity: 10, entry: 500, entryFee: 0, mark: 500, quoteTime: 1, openedAt: 1 } }, pending: { 'THYAO.IS': { side: 'SELL', after: 1, expires: 2, reason: 'exit' }, 'AKBNK.IS': { side: 'BUY', after: 1, expires: 2, reason: 'entry' } } };
  vi.mocked(prisma.paperBot.findFirst).mockResolvedValue({ id: 'bot', userId: 'owner', version: 3, running: true, config: settings, state } as any);
  expect((await PATCH(req('PATCH', { id: 'bot', action: 'scan-all' }))).status).toBe(200);
  const data = vi.mocked(prisma.paperBot.updateMany).mock.calls[0][0].data as any;
  expect(data.config).toEqual({ ...settings, scope: 'all', symbols: [] });
  expect(data.state).toMatchObject({ cash: 95000, paused: true, holdings: state.holdings, pending: { 'THYAO.IS': state.pending['THYAO.IS'] } });
  expect(data.state.pending['AKBNK.IS']).toBeUndefined();
  expect(data.running).toBe(true);
});
