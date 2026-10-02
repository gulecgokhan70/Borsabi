import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/position-valuation', () => ({ valuePositions: vi.fn() }));
import { valuePositions } from '../lib/position-valuation';
import { activityAsset, presentAssetActivity } from '../lib/asset-activity';
const time = new Date('2026-09-25T10:00:00Z');
const empty = () => ({ open: [], closed: [], trades: [], bots: [], events: [], exits: [] }) as any;
const event = (id: string, extra = {}) => ({ id, data: { time: time.getTime(), action: 'BUY', symbol: 'BTC-USD', quantity: 2, price: 100, fee: 2, ...extra } });
beforeEach(() => { vi.mocked(valuePositions).mockReset(); });
it('normalizes BIST aliases without conflating crypto or indices', () => {
  expect(activityAsset(' a1cap ')).toMatchObject({ symbol: 'A1CAP.IS', aliases: ['A1CAP.IS', 'A1CAP'] });
  expect(activityAsset('btc-usd')?.market).toBe('CRYPTO');
  expect(activityAsset('XU100.IS')).toBeNull(); expect(activityAsset('BTC')).toBeNull();
});
it('keeps crypto unit currencies distinct from fee-inclusive TRY values and transfer records', async () => {
  const s = empty();
  s.open = [{ id: 'manual', type: 'CRYPTO', entryPrice: 5, entryPriceTry: 200, quantity: 2, commission: 4, openedAt: time }];
  vi.mocked(valuePositions).mockResolvedValue([{ id: 'manual', totalValue: 440, pnl: 36, priceStale: false }] as any);
  s.bots = [{ id: 'bot', config: { funding: 'portfolio' }, state: { holdings: {
    'BTC-USD': { quantity: 2, entry: 200, entryFee: 4, mark: 220, openedAt: time.getTime(), quoteTime: time.getTime() },
    'ETH-USD': { quantity: 1, entry: 1, entryFee: 0, mark: 2, openedAt: time.getTime() },
  } } }];
  s.trades = [{ id: 'trade', type: 'BUY', marketType: 'CRYPTO', quantity: 2, price: 5, total: 400, commission: 4, pnl: null, createdAt: time }];
  s.events = [event('transfer', { portfolio: true, transfer: true }), event('old')];
  const result = await presentAssetActivity(s, activityAsset('BTC-USD')!);
  expect(result.open).toHaveLength(2);
  expect(result.open[0]).toMatchObject({ currency: 'USD', entry: 5, cost: 404, value: 440, pnl: 36 });
  expect(result.open[1]).toMatchObject({ currency: 'TRY', entry: 200, cost: 404, value: 440, pnl: 36 });
  expect(result.trades.find(t => t.id === 'trade')).toMatchObject({ currency: 'USD', price: 5, total: 400 });
  expect(result.trades.find(t => t.id === 'transfer')).toMatchObject({ action: 'TRANSFER', origin: 'Bot' });
  expect(result.trades.find(t => t.id === 'old')?.origin).toBe('Eski sanal bot');
});
it('preserves history when valuation fails and does not invent closed quantities or legacy FX costs', async () => {
  const s = empty();
  s.open = [{ id: 'legacy', type: 'CRYPTO', entryPrice: 5, entryPriceTry: null, quantity: 2, commission: 0, openedAt: time }];
  s.closed = [{ id: 'closed', quantity: 0, closedAt: time, pnl: 12 }];
  s.exits = [event('sell', { action: 'SELL', portfolio: true, pnl: 8 })];
  s.trades = [{ id: 'partial', type: 'SELL', quantity: 1, price: 8, marketType: 'CRYPTO', total: 320, commission: 1, pnl: 6, createdAt: time, executionReason: 'STOP_LOSS' }];
  vi.mocked(valuePositions).mockRejectedValue(new Error('FX unavailable'));
  const r = await presentAssetActivity(s, activityAsset('BTC-USD')!);
  expect(r.valuationUnavailable).toBe(true); expect(r.open[0]).toMatchObject({ cost: null, value: null, pnl: null });
  expect(r.closed).toHaveLength(2); expect(r.closed.find(p => p.id === 'closed')).toEqual({ id: 'closed', closedAt: time.toISOString(), origin: 'Manuel', pnl: 12 });
  expect(r.trades[0]).toMatchObject({ origin: 'Otomatik satış', pnl: 6 });
});
it('caps combined histories rather than returning twenty rows per origin', async () => {
  const s = empty(); s.events = Array.from({ length: 21 }, (_, i) => event(String(i), { action: 'SELL', time: time.getTime() + i * 1000 })); s.exits = s.events;
  const r = await presentAssetActivity(s, activityAsset('BTC-USD')!);
  expect(r.trades).toHaveLength(20); expect(r.closed).toHaveLength(20);
  expect(r.trades[0].id).toBe('20'); expect(r.moreClosed && r.moreTrades).toBe(true);
});
