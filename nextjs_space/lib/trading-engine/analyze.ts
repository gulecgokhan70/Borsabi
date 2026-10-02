import { getTradingProfile } from './config';
import { buildIndicatorSnapshot } from './indicators';
import { prepareClosedCandles } from './market-data';
import { detectMarketRegime } from './market-regime';
import { selectStrategies } from './strategy-engine';
import type { AnalyzeMarketInput, MarketAnalysis, RegimeResult } from './types';

/** Pure analysis: no network, database writes, order routing or wall-clock reads. */
export function analyzeMarket(input: AnalyzeMarketInput): MarketAnalysis {
  const profile = getTradingProfile(input.marketType);
  const base = { version: '2-foundation' as const, marketType: input.marketType,
    timeframe: profile.timeframe, asOf: input.asOf };
  const blocked = (status: 'INVALID_DATA' | 'INSUFFICIENT_DATA', reason: string,
    candleCount = 0, lastClosedAt: number | null = null): MarketAnalysis => {
    const regime: RegimeResult = { regime: 'UNCERTAIN', trend: 'MIXED', confidence: 0, reasons: [reason] };
    return { ...base, status, candleCount, lastClosedAt, indicators: null, regime,
      selection: selectStrategies(regime, profile), warnings: [reason] };
  };
  if (input.timeframe !== profile.timeframe) return blocked('INVALID_DATA', 'Bu profil yalnızca günlük mumları destekler.');
  const prepared = prepareClosedCandles(input.candles, input.asOf);
  if (!prepared.ok) return blocked('INVALID_DATA', prepared.reason);
  const candles = prepared.candles;
  const lastClosedAt = candles.length ? candles[candles.length - 1].closedAt : null;
  if (candles.length < profile.minimumCandles) {
    return blocked('INSUFFICIENT_DATA', `En az ${profile.minimumCandles} kapanmış mum gerekli; mevcut: ${candles.length}.`,
      candles.length, lastClosedAt);
  }
  const indicators = buildIndicatorSnapshot(candles);
  if (!indicators) return blocked('INVALID_DATA', 'İndikatör hesabı sonlu bir sonuç üretmedi.', candles.length, lastClosedAt);
  const regime = detectMarketRegime(indicators, profile);
  const warnings = ['Güven değeri kural uyumudur; kazanma olasılığı değildir.',
    'Strateji seçimi işlem onayı değildir; sinyal ve risk kontrolleri ayrıca gerekir.'];
  if (indicators.volumeRatio === null) warnings.push('Hacim geçmişi sıfır; hacim teyidi kullanılamıyor.');
  if (input.marketType === 'CRYPTO') warnings.push('BTC/ETH piyasa bağlamı bu aşamada değerlendirilmedi.');
  return { ...base, status: 'READY', candleCount: candles.length, lastClosedAt,
    indicators, regime, selection: selectStrategies(regime, profile), warnings };
}
