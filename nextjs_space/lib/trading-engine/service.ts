import { cachedChart } from '../yahoo-finance';
import { providerCandles } from './adapter';
import { analyzeMarket } from './analyze';
import { evaluateMarket } from './engine';
import type { CandleData, CryptoContext, MarketType, Timeframe } from './types';

export async function engineHistory(symbol: string, market: MarketType, timeframe: Timeframe, asOf = Date.now()) {
  // Stable range keys let users share the existing bounded upstream cache.
  const end = Math.ceil(asOf / 86400000) * 86400000;
  const days = timeframe === '1d' ? 1100 : 59;
  const response = await cachedChart(symbol, { period1: new Date(end - days * 86400000),
    period2: new Date(end), interval: timeframe === '1h' ? '60m' : timeframe });
  return providerCandles(response?.quotes ?? [], market, timeframe).filter(c => c.closedAt <= asOf);
}

export function cryptoContextAt(candles: readonly CandleData[], btc: readonly CandleData[], eth: readonly CandleData[], timeframe: Timeframe, asOf: number): CryptoContext {
  const analysis = (data: readonly CandleData[]) => analyzeMarket({ candles: data, timeframe, asOf, marketType: 'CRYPTO' });
  const own = candles.filter(c => c.closedAt <= asOf), reference = new Map(btc.filter(c => c.closedAt <= asOf).map(c => [c.closedAt, c.close]));
  const aligned = own.filter(c => reference.has(c.closedAt)).slice(-21);
  let relativeStrength: number | null = null;
  if (aligned.length === 21) {
    const first = aligned[0], last = aligned[20];
    relativeStrength = ((last.close / first.close - 1) - (reference.get(last.closedAt)! / reference.get(first.closedAt)! - 1)) * 100;
  }
  return { btc: analysis(btc), eth: analysis(eth), relativeStrength };
}

export async function marketDecision(symbol: string, market: MarketType, timeframe: Timeframe, asOf = Date.now()) {
  const candles = await engineHistory(symbol, market, timeframe, asOf);
  let context: CryptoContext | undefined;
  if (market === 'CRYPTO') {
    // Context failure blocks new signals, but does not hide the asset analysis.
    try {
      const [btc, eth] = await Promise.all([
        symbol === 'BTC-USD' ? Promise.resolve(candles) : engineHistory('BTC-USD', market, timeframe, asOf),
        symbol === 'ETH-USD' ? Promise.resolve(candles) : engineHistory('ETH-USD', market, timeframe, asOf),
      ]);
      context = cryptoContextAt(candles, btc, eth, timeframe, asOf);
    } catch { /* Fail closed in scoreSignal. */ }
  }
  return evaluateMarket({ candles, marketType: market, timeframe, asOf }, { context });
}
