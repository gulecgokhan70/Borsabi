import type { RegimeResult, StrategySelection, TradingProfile } from './types';

export function selectStrategies(result: RegimeResult, profile: TradingProfile): StrategySelection {
  // Even a volatility regime must not bypass the long-only downtrend guard.
  if ((result.regime === 'TREND_DOWN' || result.trend === 'DOWN') && !profile.allowShort) {
    return { strategies: [], mode: 'RISK_REDUCTION', direction: 'NONE', riskMultiplier: 0,
      reasons: ['Düşüş eğiliminde yeni long adayları engellendi; short desteği kapalı.'] };
  }
  switch (result.regime) {
    case 'TREND_UP':
    case 'TREND_DOWN':
      return { strategies: ['TREND_FOLLOWING', 'MOMENTUM'], mode: 'ACTIVE',
        direction: result.regime === 'TREND_UP' ? 'LONG' : 'SHORT', riskMultiplier: 1,
        reasons: ['Trend ve momentum stratejileri sinyal değerlendirmesine uygun.'] };
    case 'RANGE':
      return { strategies: ['MEAN_REVERSION'], mode: 'ACTIVE', direction: 'LONG', riskMultiplier: 1,
        reasons: ['Yatay piyasa için ortalamaya dönüş stratejisi seçildi.'] };
    case 'HIGH_VOLATILITY':
      return { strategies: ['BREAKOUT'], mode: 'WATCH_ONLY', direction: 'NONE',
        riskMultiplier: profile.risk.highVolatilityRiskMultiplier,
        reasons: ['Kırılma ve yön teyidi gerekli; sonraki risk bütçesi azaltılmalı.'] };
    case 'LOW_VOLATILITY':
      return { strategies: ['BREAKOUT'], mode: 'WATCH_ONLY', direction: 'NONE', riskMultiplier: 0,
        reasons: ['Sıkışma izleniyor; henüz kırılma sinyali yok.'] };
    default:
      return { strategies: [], mode: 'BLOCKED', direction: 'NONE', riskMultiplier: 0,
        reasons: ['Belirsiz piyasada yeni strateji adayı yok.'] };
  }
}
