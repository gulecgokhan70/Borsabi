import type { CandleData } from './types';

export type PreparedCandles =
  | { ok: true; candles: readonly CandleData[] }
  | { ok: false; reason: string };

export function prepareClosedCandles(candles: readonly CandleData[], asOf: number): PreparedCandles {
  if (!Number.isSafeInteger(asOf) || asOf <= 0) {
    return { ok: false, reason: 'Değerlendirme zamanı geçersiz.' };
  }
  const closed: CandleData[] = [];
  let previous: CandleData | undefined;
  for (const candle of candles) {
    if (!candle || !Number.isSafeInteger(candle.timestamp) || !Number.isSafeInteger(candle.closedAt)
      || candle.timestamp <= 0 || candle.closedAt <= candle.timestamp) {
      return { ok: false, reason: 'Mum açılış/kapanış zamanı geçersiz.' };
    }
    // Do not inspect future OHLCV values; only completed bars enter the engine.
    if (candle.closedAt > asOf) continue;
    if (previous && (candle.timestamp <= previous.timestamp || candle.timestamp < previous.closedAt)) {
      return { ok: false, reason: 'Mumlar sıralı, benzersiz ve çakışmasız olmalı.' };
    }
    const { open, high, low, close, volume } = candle;
    if (![open, high, low, close, volume].every(Number.isFinite)
      || low <= 0 || volume < 0 || high < low
      || open < low || open > high || close < low || close > high) {
      return { ok: false, reason: 'Mum fiyatı veya hacmi geçersiz.' };
    }
    closed.push(candle);
    previous = candle;
  }
  return { ok: true, candles: closed };
}
