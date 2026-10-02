import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock('../lib/request-limit', () => ({ takeRequestSlot: vi.fn() }));
vi.mock('../lib/trading-engine/service', () => ({ engineHistory: vi.fn(), cryptoContextAt: vi.fn() }));
vi.mock('../lib/trading-engine/backtest-engine', () => ({ runEngineBacktest: vi.fn() }));
import { getServerSession } from 'next-auth';
import { prisma } from '../lib/db';
import { engineHistory, cryptoContextAt } from '../lib/trading-engine/service';
import { runEngineBacktest } from '../lib/trading-engine/backtest-engine';
import { takeRequestSlot } from '../lib/request-limit';
import { POST } from '../app/api/strategy-builder/route';
const buy = { id: 1, direction: 'buy', indicator: 'price', operator: 'gt', compareWith: 'value', compareIndicator: 'ema20', value: 0 };
const request = (input: Record<string, unknown> = {}, origin?: string) => POST(new NextRequest('http://localhost/api/strategy-builder', {
  method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
  body: JSON.stringify({ symbol: 'THYAO.IS', rules: [buy], ...input }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ tier: 'pro', commissionRate: 0.002 } as any);
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: true, retryAfter: 0 });
  vi.mocked(engineHistory).mockResolvedValue(Array.from({ length: 240 }, (_, n) => ({ timestamp: n, closedAt: n + 1,
    open: 100, high: 101, low: 99, close: 100, volume: 100 })));
  vi.mocked(runEngineBacktest).mockReturnValue({ summary: {}, trades: [], timeline: [{ time: 240, value: 100000 }],
    equity: [100000], assumptions: [], currency: 'TRY' } as any);
});
it('authenticates and enforces server-side Pro membership before loading data', async () => {
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await request()).status).toBe(401);
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ tier: 'free' } as any);
  expect((await request()).status).toBe(403);
  expect(engineHistory).not.toHaveBeenCalled();
});
it('rejects unknown operators, indicators, duplicate ids, sell-only rules and forged costs', async () => {
  for (const input of [{ rules: [{ ...buy, operator: 'anything' }] }, { rules: [{ ...buy, indicator: 'unknown' }] },
    { rules: [{ ...buy, direction: 'sell' }] }, { rules: [buy, buy] }, { commissionRate: 0 }, { symbol: 'unknown' },
    { initialCapital: -1 }, { stopLoss: 0 }, { stopLoss: 10, takeProfit: 5 }, { period: '5m' }]) {
    expect((await request(input)).status).toBe(400);
  }
  expect(engineHistory).not.toHaveBeenCalled();
});
it('uses profile commission and percentage levels in the common simulator', async () => {
  const response = await request({ stopLoss: 7, takeProfit: 15 });
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'owner' }, select: { tier: true, commissionRate: true } });
  expect(runEngineBacktest).toHaveBeenCalledWith(expect.objectContaining({ initialCapital: 100000, stopPercent: 0.07,
    takeProfitPercent: 0.15, costs: { commission: 0.002, slippage: 0.001, spread: 0.001 }, customSignal: expect.any(Function) }));
  expect((await response.json()).engine).toBe('v2');
});
it('maps intraday periods to supported intervals and cuts crypto context at each historical decision', async () => {
  await request({ symbol: 'BTC-USD', period: '1w' });
  expect(engineHistory).toHaveBeenCalledWith('BTC-USD', 'CRYPTO', '15m', expect.any(Number));
  expect(engineHistory).toHaveBeenCalledWith('ETH-USD', 'CRYPTO', '15m', expect.any(Number));
  const options = vi.mocked(runEngineBacktest).mock.calls[0][0];
  options.contextAt!(123, []);
  expect(cryptoContextAt).toHaveBeenCalledWith(expect.any(Array), expect.any(Array), expect.any(Array), '15m', 123);
});
it('reports invalid commission, insufficient preparation data and empty sessions explicitly', async () => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ tier: 'pro', commissionRate: -1 } as any);
  expect((await request()).status).toBe(503);
  expect(engineHistory).not.toHaveBeenCalled();
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ tier: 'pro', commissionRate: 0.002 } as any);
  vi.mocked(engineHistory).mockResolvedValue([]);
  expect((await request()).status).toBe(422);
  vi.mocked(engineHistory).mockResolvedValue(Array.from({ length: 201 }, (_, n) => ({ timestamp: n, closedAt: n + 1, open: 1, high: 1, low: 1, close: 1, volume: 0 })));
  vi.mocked(runEngineBacktest).mockReturnValue({ timeline: [] } as any);
  expect((await request()).status).toBe(422);
});
it('rejects foreign origins and excessive requests before expensive simulation', async () => {
  expect((await request({}, 'https://foreign.invalid')).status).toBe(403);
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: false, retryAfter: 60 });
  expect((await request()).status).toBe(429);
  expect(takeRequestSlot).toHaveBeenCalledWith('strategy-builder:owner', 3, 60000);
  expect(runEngineBacktest).not.toHaveBeenCalled();
});
