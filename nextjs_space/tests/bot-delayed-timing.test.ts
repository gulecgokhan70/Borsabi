import { expect, it } from 'vitest';
import { autoInitial, autoStep, INTERVAL, type AutoConfig, type Observation } from '../lib/bot-lab/auto-engine';
const now = Date.parse('2026-09-25T12:00:00Z');
const config: AutoConfig = { mode: 'auto-v2', market: 'BIST', scope: 'all', symbols: ['THYAO.IS'], commission: 0, friction: 0, orderFraction: 0.05, dailyLoss: 0.02, stopLoss: 0.02, takeProfit: 0.04, maxPositions: 3 };
function observation(quoteTime: number, observedAt: number, price = 103): Observation {
  return { symbol: 'THYAO.IS', source: 'Yahoo Finance', observedAt, tick: { time: quoteTime, price, open: true },
    bars: Array.from({ length: 70 }, (_, i) => ({ time: now - (70 - i) * INTERVAL, close: i === 69 ? 103 : 100, volume: i === 69 ? 2000 : 1000 })) };
}
it('a delayed signal never fills using a pre-decision price; records signal, source price and booking times separately', () => {
  const state = autoInitial(); state.paused = false; state.lastBars['THYAO.IS'] = now - 2 * INTERVAL;
  const signal = autoStep(state, config, [observation(now - INTERVAL, now)], now);
  expect(signal.state.pending['THYAO.IS']).toMatchObject({ after: now, signalBarTime: now - INTERVAL, signalQuoteTime: now - INTERVAL, source: 'Yahoo Finance' });
  const waiting = autoStep(signal.state, config, [observation(now - 14 * 60000, now + 60000)], now + 60000);
  expect(waiting.events).toEqual([]);
  expect(waiting.state.cash).toBe(100000);
  const filled = autoStep(waiting.state, config, [observation(now + 60000, now + 16 * 60000)], now + 16 * 60000);
  expect(filled.events[0]).toMatchObject({ action: 'BUY', signalAt: now, signalBarTime: now - INTERVAL,
    quoteTime: now + 60000, time: now + 16 * 60000, observedAt: now + 16 * 60000, source: 'Yahoo Finance' });
  expect(filled.state.holdings['THYAO.IS'].source).toBe('Yahoo Finance');
});
it('protective exits disclose delayed modeled prices without inventing a prior signal timestamp', () => {
  const state = autoInitial(); state.cash = 99000;
  state.holdings['THYAO.IS'] = { entry: 100, entryFee: 0, quantity: 10, mark: 100, quoteTime: now - 20 * 60000, openedAt: now - 30 * 60000 };
  const result = autoStep(state, config, [observation(now - INTERVAL, now, 90)], now);
  expect(result.events[0]).toMatchObject({ action: 'SELL', quoteTime: now - INTERVAL, time: now, signalAt: now, source: 'Yahoo Finance' });
  expect(result.events[0].signalBarTime).toBeUndefined();
  expect(result.state.holdings).toEqual({});
});
it('an older cached batch cannot replace a candidate evaluated with a newer quote', () => {
  const state = autoInitial(); state.paused = false;
  const current = autoStep(state, config, [observation(now - INTERVAL, now)], now);
  const cached = autoStep(current.state, config, [observation(now - INTERVAL - 60000, now - 60000)], now + 1000);
  expect(cached.state.candidates).toEqual(current.state.candidates);
  expect(cached.events).toEqual([]);
});
