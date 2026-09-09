import { expect, it } from 'vitest';
import { createReplay, applyReplay, replayView } from '../lib/replay';
const bars = Array.from({ length: 50 }, (_, i) => ({ time: new Date(1700000000000 + i * 300000).toISOString(), open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i, volume: 100 }));
it('does not return future bars, including when finishing before the last candle', () => {
  const state = createReplay('BTC-USD', bars);
  expect(replayView(state).bars).toHaveLength(30);
  const finished = applyReplay(state, { action: 'FINISH', note: '' });
  expect(replayView(finished).bars).toHaveLength(30);
  expect(JSON.stringify(replayView(finished))).not.toContain(bars[49].time);
});
it('charges both commissions and keeps original state immutable', () => {
  const initial = createReplay('BTC-USD', bars);
  const bought = applyReplay(initial, { action: 'BUY', quantity: 1, note: 'Plan' });
  expect(bought.cash).toBeCloseTo(10000 - 130 * 1.002);
  expect(initial.cash).toBe(10000); expect(initial.trades).toHaveLength(0);
  const next = applyReplay(bought, { action: 'NEXT', note: '' });
  const sold = applyReplay(next, { action: 'SELL', quantity: 1, note: '' });
  expect(sold.cash - sold.initial).toBeCloseTo(1 - 130 * .002 - 131 * .002);
  expect(sold.quantity).toBe(0); expect(sold.cost).toBe(0);
});
it('blocks overspending, overselling, fractional BIST and writes after finishing', () => {
  const s = createReplay('THYAO.IS', bars);
  expect(() => applyReplay(s, { action: 'BUY', quantity: 100000, note: '' })).toThrow('yetersiz');
  expect(() => applyReplay(s, { action: 'SELL', quantity: 1, note: '' })).toThrow('yeterli');
  expect(() => applyReplay(s, { action: 'BUY', quantity: .5, note: '' })).toThrow('tam sayı');
  expect(() => applyReplay({ ...s, finished: true }, { action: 'NEXT', note: '' })).toThrow('tamamlandı');
});
it('rejects unordered and malformed historical data instead of inventing candles', () => {
  expect(() => createReplay('BTC-USD', [...bars].reverse())).toThrow('doğrulanamadı');
  expect(() => createReplay('BTC-USD', bars.map(b => ({ ...b, high: 1 })))).toThrow('doğrulanamadı');
  expect(() => createReplay('BTC-USD', [])).toThrow('yeterli');
});
