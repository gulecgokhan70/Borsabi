import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock('../lib/constants', () => ({ BIST_TOP_STOCKS: [{ symbol: 'THYAO.IS', name: 'THY', shortName: 'THYAO' }],
  CRYPTO_ASSETS: [{ symbol: 'BTC-USD', name: 'Bitcoin', shortName: 'BTC' }, { symbol: 'ETH-USD', name: 'Ethereum', shortName: 'ETH' }] }));
vi.mock('../lib/yahoo-finance', () => ({ cachedQuote: vi.fn() }));
vi.mock('../lib/midas-api', () => ({ getMidasStockMap: vi.fn() }));
vi.mock('../lib/request-limit', () => ({ takeRequestSlot: vi.fn() }));
vi.mock('../lib/trading-engine/service', () => ({ engineHistory: vi.fn(), cryptoContextAt: vi.fn() }));
vi.mock('../lib/trading-engine/engine', () => ({ evaluateMarket: vi.fn() }));
import { getServerSession } from 'next-auth';
import { prisma } from '../lib/db';
import { cachedQuote } from '../lib/yahoo-finance';
import { getMidasStockMap } from '../lib/midas-api';
import { takeRequestSlot } from '../lib/request-limit';
import { engineHistory, cryptoContextAt } from '../lib/trading-engine/service';
import { evaluateMarket } from '../lib/trading-engine/engine';
import { POST } from '../app/api/algo-scan/route';
const candles = Array.from({ length: 220 }, (_, n) => ({ timestamp: n * 86400000, closedAt: (n + 1) * 86400000,
  open: 100, high: 102, low: 98, close: 100, volume: 1000 }));
const request = (body: unknown = {}, origin?: string) => POST(new NextRequest('http://localhost/api/algo-scan', {
  method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ tier: 'pro' } as any);
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: true, retryAfter: 0 });
  vi.mocked(getMidasStockMap).mockResolvedValue(new Map());
  vi.mocked(cachedQuote).mockResolvedValue({ regularMarketPrice: 200, regularMarketChangePercent: 3, regularMarketVolume: 99999 } as any);
  vi.mocked(engineHistory).mockResolvedValue(candles);
  vi.mocked(cryptoContextAt).mockReturnValue({ relativeStrength: 0 } as any);
  vi.mocked(evaluateMarket).mockReturnValue({ analysis: { status: 'READY', lastClosedAt: 123,
    indicators: { close: 100, rsi: 42, volumeRatio: 1.2, adx: 25, plusDI: 20, minusDI: 10,
      macd: { macd: 1, signal: 0.5, histogram: 0.5 }, bollinger: { upper: 105, middle: 100, lower: 95, bandwidth: 10 } } },
    signal: { score: 37, direction: 'NONE', confidence: 0.4, regime: 'UNCERTAIN', reasons: ['bekle'], warnings: ['bağlam eksik'] } } as any);
});
it('requires login before fetching market data', async () => {
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await request()).status).toBe(401);
  expect(engineHistory).not.toHaveBeenCalled();
});
it('rejects malformed filters, inverted ranges, and unknown keys', async () => {
  for (const body of [{ market: 'OTHER' }, { emaPeriod: 3 }, { rsiMin: 90, rsiMax: 10 }, { priceMin: -1 }, { userId: 'other' }]) {
    expect((await request(body)).status).toBe(400);
  }
  expect(engineHistory).not.toHaveBeenCalled();
});
it('requires Pro membership before fetching market data', async () => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ tier: 'free' } as any);
  expect((await request()).status).toBe(403);
  expect(engineHistory).not.toHaveBeenCalled();
});
it('enforces same-origin requests and owner-scoped rate limit', async () => {
  expect((await request({}, 'https://foreign.invalid')).status).toBe(403);
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: false, retryAfter: 60 });
  expect((await request()).status).toBe(429);
  expect(takeRequestSlot).toHaveBeenCalledWith('algo-scan:owner', 3, 60000);
  expect(engineHistory).not.toHaveBeenCalled();
});
it('returns common engine score without candle bonuses and separates live quotes from indicators', async () => {
  const response = await request();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  const body = await response.json();
  expect(body.results[0]).toMatchObject({ score: 37, rsi: 42, volRatio: 1.2, price: 200, currency: 'TRY', direction: 'NONE', engine: 'v2' });
  expect(engineHistory).toHaveBeenCalledWith('THYAO.IS', 'BIST', '1d', expect.any(Number));
  expect(evaluateMarket).toHaveBeenCalledWith({ candles, marketType: 'BIST', timeframe: '1d', asOf: expect.any(Number) }, { context: undefined });
});
it('uses the closed candle, not the live price, for EMA and Bollinger filters', async () => {
  expect((await (await request({ emaFilter: 'below', bollingerPos: 'lower' })).json()).total).toBe(1);
});
it('loads crypto benchmarks once and keeps blocked signals visible as watch-only', async () => {
  const response = await request({ market: 'CRYPTO' });
  const body = await response.json();
  expect(engineHistory).toHaveBeenCalledTimes(2);
  expect(cryptoContextAt).toHaveBeenCalledTimes(2);
  expect(body.results).toHaveLength(2);
  expect(body.results[0]).toMatchObject({ currency: 'USD', direction: 'NONE', warnings: ['bağlam eksik'] });
});
it('reports unavailable data separately from a legitimate empty filter result', async () => {
  expect((await request({ rsiMin: 90 })).status).toBe(200);
  vi.mocked(evaluateMarket).mockReturnValue({ analysis: { status: 'INSUFFICIENT_DATA', indicators: null } } as any);
  expect((await request()).status).toBe(503);
});
