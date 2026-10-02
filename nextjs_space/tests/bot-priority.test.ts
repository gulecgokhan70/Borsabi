import { expect, it } from 'vitest';
import { autoInitial, type AutoConfig, type Candidate } from '../lib/bot-lab/auto-engine';
import { botCatalog } from '../lib/bot-lab/catalog';
import { prioritySymbols, quoteAgeLabel } from '../lib/bot-lab/priority';
const now = Date.parse('2026-09-25T12:00:00Z');
const config = { scope: 'all', market: 'BIST' } as AutoConfig;
const candidate = (symbol: string, score = 60): Candidate => ({ symbol, score, eligible: false, reason: 'waiting for crossover', barTime: now - 900000, checkedAt: now, cross: null });
it('prioritizes at most twelve supported recent promising candidates, excluding protected assets', () => {
  const state = autoInitial(); state.paused = false;
  const symbols = botCatalog.BIST.slice(0, 25);
  state.candidates = symbols.map((symbol, i) => candidate(symbol, 70 - i));
  state.holdings[symbols[0]] = { entry: 10, quantity: 1, entryFee: 0, mark: 10, quoteTime: now, openedAt: now };
  state.pending[symbols[1]] = { side: 'BUY', after: now, expires: now + 60000, reason: 'test' };
  state.candidates.push(candidate('FAKE.IS', 100), { ...candidate(symbols[24], 100), checkedAt: now - 31 * 60000 });
  const focus = prioritySymbols(config, state, now);
  expect(focus).toEqual(symbols.slice(2, 14));
  expect(state.candidates.length).toBe(27);
});
it('does not revive old, malformed or failed candidates, or scan during pause/selected mode', () => {
  const state = autoInitial(); state.paused = false;
  state.candidates = [candidate('THYAO.IS', 39), { ...candidate('TUPRS.IS'), barTime: 0 },
    { ...candidate('ASELS.IS'), checkedAt: now + 1 }, candidate('AKBNK.IS', NaN)];
  expect(prioritySymbols(config, state, now)).toEqual([]);
  state.candidates = [candidate('THYAO.IS')];
  expect(prioritySymbols(config, state, now)).toEqual(['THYAO.IS']);
  expect(prioritySymbols({ ...config, scope: 'selected' }, state, now)).toEqual([]);
  expect(prioritySymbols(config, { ...state, paused: true }, now)).toEqual([]);
  expect(prioritySymbols(config, { ...state, closeRequested: true }, now)).toEqual([]);
});
it('reports age from the source timestamp rather than the latest worker check', () => {
  expect(quoteAgeLabel(now - 15 * 60000, now)).toBe('Fiyat yaşı: 15 dk');
  expect(quoteAgeLabel(now - 15000, now)).toBe('Fiyat yaşı: 15 sn');
  expect(quoteAgeLabel(undefined, now)).toContain('bilinmiyor');
  expect(quoteAgeLabel(now + 1, now)).toContain('geçersiz');
});
