import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/constants', () => ({ BIST_TOP_STOCKS: [{ symbol: 'THYAO.IS', shortName: 'THYAO', name: 'THY' }] }));
vi.mock('../lib/midas-api', () => ({ getMidasStockMap: vi.fn() }));
vi.mock('../lib/request-limit', () => ({ takeRequestSlot: vi.fn() }));
vi.mock('../lib/scan-cache', () => ({ cachedScan: vi.fn() }));
vi.mock('../lib/scan-utils', () => ({ fetchStockData: vi.fn(), isBistMarketHours: () => true, SCAN_BATCH_SIZE: 8,
  processInBatches: async (stocks: any[], _batch: number, callback: any) => Promise.all(stocks.map(callback)) }));
import { getServerSession } from 'next-auth';
import { getMidasStockMap } from '../lib/midas-api';
import { takeRequestSlot } from '../lib/request-limit';
import { cachedScan } from '../lib/scan-cache';
import { fetchStockData } from '../lib/scan-utils';
import { GET as day } from '../app/api/day-trading/route';
import { GET as swing } from '../app/api/swing-trading/route';
const request = new NextRequest('http://localhost/api/day-trading');
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: true, retryAfter: 0 });
  vi.mocked(getMidasStockMap).mockResolvedValue(new Map());
  vi.mocked(cachedScan).mockImplementation(async (_key, scan) => ({ result: await scan(), cachedAt: new Date().toISOString(), fresh: true }));
  const bars = Array.from({ length: 220 }, () => ({ open: 100, high: 102, low: 98, close: 100 }));
  vi.mocked(fetchStockData).mockResolvedValue({ price: 100, volume: 100, avgVolume: 100, changePercent: 0,
    effectiveQuote: { regularMarketPrice: 100, regularMarketPreviousClose: 100 },
    ohlcv: { closes: bars.map(c => c.close), highs: bars.map(c => c.high), lows: bars.map(c => c.low), opens: bars.map(c => c.open), volumes: bars.map(() => 100), candleData: bars },
    engine: { analysis: { status: 'READY', lastClosedAt: Date.now(), indicators: { rsi: 42, atr: 1, ema200: 99,
      macd: { macd: 1, signal: 0.5, histogram: 0.5, prevHistogram: 0 } } },
      signal: { score: 37, direction: 'NONE', regime: 'UNCERTAIN', reasons: ['V2 nedeni'], warnings: ['V2 uyarısı'],
        components: { trend: 10, momentum: 10, volume: 7, structure: 5, candle: 0, volatility: 0, regime: 5 } } } } as any);
});
it('requires a session and rate-limit slot before reading or running shared scans', async () => {
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await day(request)).status).toBe(401);
  expect((await swing(request)).status).toBe(401);
  expect(cachedScan).not.toHaveBeenCalled();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  vi.mocked(takeRequestSlot).mockReturnValue({ allowed: false, retryAfter: 60 });
  expect((await day(request)).status).toBe(429);
  expect((await swing(request)).status).toBe(429);
});
it('uses 15m for day and daily for swing; preserves V2 scores even below old cutoffs', async () => {
  for (const [route, timeframe, key] of [[day, '15m', 'day-trading-v2'], [swing, '1d', 'swing-trading-v2']] as const) {
    const response = await route(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const body = await response.json();
    expect(body.data[0]).toMatchObject({ score: 37, engine: 'v2', timeframe, passesFilter: false });
    expect(body.data[0].signals).toContain('V2 nedeni');
    expect(cachedScan).toHaveBeenCalledWith(key, expect.any(Function));
    expect(fetchStockData).toHaveBeenCalledWith('THYAO', 'THYAO.IS', null, expect.any(Object), { timeframe, asOf: expect.any(Number) });
  }
});
it('does not present stale cache or expired candle confirmations as current entries', async () => {
  const stale = { data: [{ score: 90, passesFilter: true, direction: 'LONG', signals: [], lastClosedAt: Date.now() }], marketOpen: true };
  vi.mocked(cachedScan).mockResolvedValue({ result: stale, cachedAt: new Date().toISOString(), fresh: false });
  for (const route of [day, swing]) {
    expect((await (await route(request)).json()).data[0]).toMatchObject({ passesFilter: false, direction: 'NONE' });
  }
  vi.mocked(cachedScan).mockResolvedValue({ result: { ...stale, data: [{ ...stale.data[0], lastClosedAt: Date.now() - 16 * 60000 }] }, cachedAt: new Date().toISOString(), fresh: true });
  expect((await (await day(request)).json()).data[0].passesFilter).toBe(false);
});
it('reports total upstream failure rather than a successful empty scan', async () => {
  vi.mocked(fetchStockData).mockResolvedValue(null);
  expect((await day(request)).status).toBe(500);
  expect((await swing(request)).status).toBe(500);
});
