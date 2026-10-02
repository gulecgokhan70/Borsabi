import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: { position: { findFirst: vi.fn(), updateMany: vi.fn() } } }));
vi.mock('../lib/automation', () => ({ automationStatus: vi.fn() }));
import { getServerSession } from 'next-auth';
import { prisma } from '../lib/db';
import { automationStatus } from '../lib/automation';
import { PATCH } from '../app/api/positions/orders/route';
import { NextRequest } from 'next/server';
const date = new Date('2026-09-17T10:00:00.000Z');
const body = { id: 'p', updatedAt: date.toISOString(), stopLoss: 90, takeProfit: 120, trailingStopPercent: 5, autoExit: true };
const req = (changes = {}) => new NextRequest('http://localhost/api/positions/orders', { method: 'PATCH', body: JSON.stringify({ ...body, ...changes }) });
beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } } as any);
  vi.mocked(prisma.position.findFirst).mockResolvedValue({ id: 'p', updatedAt: date, trailingStopPercent: 5, trailingStopHighest: 115, currentPrice: 105, entryPrice: 100 } as any);
  vi.mocked(prisma.position.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(automationStatus).mockResolvedValue({ active: true, lastCheck: date });
});
it('authenticates and scopes writes to the owner, open state and snapshot version; never edits ledger fields', async () => {
  expect((await PATCH(req())).status).toBe(200);
  expect(prisma.position.findFirst).toHaveBeenCalledWith({ where: { id: 'p', userId: 'owner', status: 'OPEN' } });
  expect(prisma.position.updateMany).toHaveBeenCalledWith({ where: { id: 'p', userId: 'owner', status: 'OPEN', updatedAt: date },
    data: { stopLoss: 90, takeProfit: 120, trailingStopPercent: 5, autoExit: true, trailingStopHighest: 115 } });
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await PATCH(req())).status).toBe(401);
});
it('rejects missing positions, stale editor snapshots and races with a sale', async () => {
  expect((await PATCH(req({ updatedAt: new Date(0).toISOString() }))).status).toBe(409);
  expect(prisma.position.updateMany).not.toHaveBeenCalled();
  vi.mocked(prisma.position.findFirst).mockResolvedValueOnce(null);
  expect((await PATCH(req())).status).toBe(404);
  vi.mocked(prisma.position.updateMany).mockResolvedValue({ count: 0 });
  expect((await PATCH(req())).status).toBe(409);
});
it('rejects invalid thresholds and unexpected financial fields', async () => {
  for (const invalid of [{ stopLoss: -1 }, { trailingStopPercent: 100 }, { stopLoss: 130 }, { quantity: 999 }, { stopLoss: '90' }]) {
    expect((await PATCH(req(invalid))).status).toBe(400);
  }
  expect(prisma.position.updateMany).not.toHaveBeenCalled();
});
it('requires an active worker and at least one threshold for automatic execution', async () => {
  expect((await PATCH(req({ stopLoss: null, takeProfit: null, trailingStopPercent: null }))).status).toBe(409);
  vi.mocked(automationStatus).mockResolvedValue({ active: false, lastCheck: null });
  expect((await PATCH(req())).status).toBe(409);
  expect(prisma.position.updateMany).not.toHaveBeenCalled();
});
it('clears thresholds and trailing high when disabled without requiring a worker', async () => {
  expect((await PATCH(req({ stopLoss: null, takeProfit: null, trailingStopPercent: null, autoExit: false }))).status).toBe(200);
  expect(prisma.position.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { stopLoss: null, takeProfit: null, trailingStopPercent: null, autoExit: false, trailingStopHighest: null } }));
  expect(automationStatus).not.toHaveBeenCalled();
});
