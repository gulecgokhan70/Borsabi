import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: { transaction: { findFirst: vi.fn() } } }));
vi.mock('../lib/ai-provider', () => ({ requestAICompletion: vi.fn() }));
vi.mock('../lib/request-limit', () => ({ takeRequestSlot: () => ({ allowed: true }) }));
import { getServerSession } from 'next-auth';
import { prisma } from '../lib/db';
import { requestAICompletion } from '../lib/ai-provider';
import { POST } from '../app/api/trade-coach/route';
const request = () => new NextRequest('http://localhost/api/trade-coach', { method: 'POST', body: JSON.stringify({ transactionId: 'trade', userId: 'other', total: 999999, pnl: 999999 }) });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);
});
it('requires a session and scopes lookup to its owner', async () => {
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await POST(request())).status).toBe(401);
  expect(prisma.transaction.findFirst).not.toHaveBeenCalled();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  expect((await POST(request())).status).toBe(404);
  expect(prisma.transaction.findFirst).toHaveBeenCalledWith({ where: { id: 'trade', userId: 'owner' } });
  expect(requestAICompletion).not.toHaveBeenCalled();
});
it('ignores client amounts and retains the verified receipt when AI is offline', async () => {
  vi.mocked(prisma.transaction.findFirst).mockResolvedValue({ id: 'trade', userId: 'owner', symbol: 'BTC-USD', marketType: 'CRYPTO', type: 'BUY', price: 100, quantity: 1, total: 4000, commission: 8, fxRate: 40, pnl: null, stopLoss: 90, createdAt: new Date('2026-09-09T00:00:00Z') } as any);
  vi.mocked(requestAICompletion).mockRejectedValue(new Error('offline'));
  const response = await POST(request());
  const data = await response.json();
  expect(response.status).toBe(200);
  expect(data).toMatchObject({ aiAvailable: false, facts: { totalTry: 4000, cashChangeTry: -4008, pnlTry: null, plannedRiskTry: 400 } });
  expect(JSON.stringify(vi.mocked(requestAICompletion).mock.calls)).not.toContain('999999');
});
