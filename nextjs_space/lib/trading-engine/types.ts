export type MarketType = 'BIST' | 'CRYPTO';
export type MarketRegime =
  | 'TREND_UP' | 'TREND_DOWN' | 'RANGE'
  | 'HIGH_VOLATILITY' | 'LOW_VOLATILITY' | 'UNCERTAIN';
export type Strategy = 'TREND_FOLLOWING' | 'MOMENTUM' | 'MEAN_REVERSION' | 'BREAKOUT';
export type Direction = 'LONG' | 'SHORT' | 'NONE';

/** Provider adapters must supply UTC epoch milliseconds, never seconds.
 * timestamp is the opening time; closedAt is the actual candle closing time.
 * In-progress candles must retain their future closing time.
 */
export interface CandleData {
  readonly timestamp: number;
  readonly closedAt: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

/** Phase 1 thresholds are daily-bar research defaults, not calibrated models. */
export interface TradingProfile {
  readonly marketType: MarketType;
  readonly timeframe: '1d';
  readonly sessionBased: boolean;
  readonly timeZone: string;
  readonly allowShort: boolean;
  readonly minimumCandles: number;
  readonly regime: Readonly<{
    trendAdx: number;
    rangeAdx: number;
    highAtrPercent: number;
    lowAtrPercent: number;
    lowBandwidthPercent: number;
    rangeMiddleFraction: number;
  }>;
  readonly risk: Readonly<{
    maxRiskPerTrade: number; // decimal fraction: 0.01 = 1%
    dailyLossLimit: number;
    atrStopMultiplier: number;
    highVolatilityRiskMultiplier: number;
  }>;
}

export interface IndicatorSnapshot {
  readonly close: number;
  readonly ema20: number;
  readonly ema50: number;
  readonly ema200: number;
  readonly adx: number;
  readonly plusDI: number;
  readonly minusDI: number;
  readonly atr: number;
  readonly atrPercent: number; // percentage points: 2 = 2%
  readonly rsi: number;
  readonly macd: Readonly<{ macd: number; signal: number; histogram: number; prevHistogram: number }>;
  readonly bollinger: Readonly<{ upper: number; middle: number; lower: number; bandwidth: number }>;
  readonly volumeRatio: number | null; // null when the baseline volume is zero
}

export interface RegimeResult {
  readonly regime: MarketRegime;
  readonly trend: 'UP' | 'DOWN' | 'MIXED';
  /** 0..1 rule agreement, NOT a calibrated win probability. */
  readonly confidence: number;
  readonly reasons: readonly string[];
}

export interface StrategySelection {
  readonly strategies: readonly Strategy[];
  readonly mode: 'ACTIVE' | 'WATCH_ONLY' | 'RISK_REDUCTION' | 'BLOCKED';
  readonly direction: Direction;
  /** Relative multiplier for the later risk engine, not order permission. */
  readonly riskMultiplier: number;
  readonly reasons: readonly string[];
}

export interface AnalyzeMarketInput {
  readonly marketType: MarketType;
  readonly timeframe: '1d';
  readonly candles: readonly CandleData[];
  readonly asOf: number; // explicit evaluation clock: UTC epoch milliseconds
}

export interface MarketAnalysis {
  readonly version: '2-foundation';
  readonly marketType: MarketType;
  readonly timeframe: '1d';
  readonly asOf: number;
  readonly lastClosedAt: number | null;
  readonly status: 'READY' | 'INSUFFICIENT_DATA' | 'INVALID_DATA';
  readonly candleCount: number;
  readonly indicators: IndicatorSnapshot | null;
  readonly regime: RegimeResult;
  readonly selection: StrategySelection;
  readonly warnings: readonly string[];
}
