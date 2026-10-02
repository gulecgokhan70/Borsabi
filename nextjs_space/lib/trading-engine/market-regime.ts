import type { IndicatorSnapshot, RegimeResult, TradingProfile } from './types';

export function detectMarketRegime(i: IndicatorSnapshot, profile: TradingProfile): RegimeResult {
  const p = profile.regime;
  const trend = i.ema20 > i.ema50 && i.ema50 > i.ema200 ? 'UP'
    : i.ema20 < i.ema50 && i.ema50 < i.ema200 ? 'DOWN' : 'MIXED';
  // Volatility takes precedence; keep trend independently for risk decisions.
  if (i.atrPercent >= p.highAtrPercent) {
    return { regime: 'HIGH_VOLATILITY', trend, confidence: 0.8,
      reasons: [`ATR %${i.atrPercent.toFixed(2)}, profil eşiği %${p.highAtrPercent} üzerinde veya eşit.`] };
  }
  if (i.atrPercent <= p.lowAtrPercent && i.bollinger.bandwidth <= p.lowBandwidthPercent) {
    return { regime: 'LOW_VOLATILITY', trend, confidence: 0.8,
      reasons: ['ATR ve Bollinger bant genişliği düşük; kırılma teyidi beklenmeli.'] };
  }
  if (trend === 'UP' && i.adx >= p.trendAdx && i.plusDI > i.minusDI) {
    const momentumConfirms = i.macd.histogram > 0;
    return { regime: 'TREND_UP', trend, confidence: momentumConfirms ? 0.85 : 0.7,
      reasons: ['EMA20 > EMA50 > EMA200.', 'ADX güçlü ve pozitif yön baskın.',
        momentumConfirms ? 'MACD momentumu yükselişi destekliyor.' : 'MACD momentumu yükselişi teyit etmiyor.'] };
  }
  if (trend === 'DOWN' && i.adx >= p.trendAdx && i.minusDI > i.plusDI) {
    const momentumConfirms = i.macd.histogram < 0;
    return { regime: 'TREND_DOWN', trend, confidence: momentumConfirms ? 0.85 : 0.7,
      reasons: ['EMA20 < EMA50 < EMA200.', 'ADX güçlü ve negatif yön baskın.',
        momentumConfirms ? 'MACD momentumu düşüşü destekliyor.' : 'MACD momentumu düşüşü teyit etmiyor.'] };
  }
  const middleDistance = Math.abs(i.close - i.bollinger.middle);
  const width = i.bollinger.upper - i.bollinger.lower;
  if (i.adx <= p.rangeAdx && width > 0 && middleDistance <= width * p.rangeMiddleFraction) {
    return { regime: 'RANGE', trend, confidence: 0.7,
      reasons: ['ADX düşük.', 'Fiyat Bollinger bandının orta bölgesinde.'] };
  }
  return { regime: 'UNCERTAIN', trend, confidence: 0,
    reasons: ['Trend, yön veya oynaklık koşulları net bir rejimi teyit etmiyor.'] };
}
