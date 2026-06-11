/**
 * Paylaşılan Teknik İndikatör Hesaplamaları
 * Tüm tarama motorları bu modülü kullanır — DRY & tutarlı sonuçlar
 */

// ===== EMA (Üssel Hareketli Ortalama) =====
export function calculateEMA(data: number[], period: number): number[] {
  if (!data || data.length === 0) return [];
  // Period veri uzunluğundan büyükse, mevcut veriyle hesapla
  const effectivePeriod = Math.min(period, data.length);
  const k = 2 / (effectivePeriod + 1);
  const ema: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push((data[i] * k) + (ema[i - 1] * (1 - k)));
  }
  return ema;
}

// Son EMA değerini al (yardımcı)
export function lastEMA(data: number[], period: number): number {
  const ema = calculateEMA(data, period);
  return ema.length > 0 ? ema[ema.length - 1] : 0;
}

// ===== RSI (Göreceli Güç Endeksi) =====
export function calculateRSI(closes: number[], period = 14): number {
  if (!closes || closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  const start = closes.length - period;
  for (let i = start; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// ===== MACD =====
export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  prevHistogram: number;
}

export function calculateMACD(closes: number[]): MACDResult {
  if (!closes || closes.length < 26) return { macd: 0, signal: 0, histogram: 0, prevHistogram: 0 };
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  // Signal line: 9-period EMA of FULL macdLine (not just last 9)
  const signalLine = calculateEMA(macdLine, 9);
  const lastIdx = macdLine.length - 1;
  const histogram = macdLine[lastIdx] - signalLine[lastIdx];
  const prevHistogram = lastIdx > 0 ? macdLine[lastIdx - 1] - signalLine[lastIdx - 1] : 0;
  return {
    macd: macdLine[lastIdx],
    signal: signalLine[lastIdx],
    histogram,
    prevHistogram,
  };
}

// ===== ATR (Ortalama Gerçek Aralık) =====
export function calculateATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (!closes || closes.length < period + 1) return 0;
  const trueRanges: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const h = highs[i] ?? 0;
    const l = lows[i] ?? 0;
    const pc = closes[i - 1] ?? 0;
    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    trueRanges.push(tr);
  }
  const recent = trueRanges.slice(-period);
  return recent.length > 0 ? recent.reduce((s, v) => s + v, 0) / recent.length : 0;
}

// ===== VWAP =====
export function calculateVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
  let cumTPV = 0;
  let cumVol = 0;
  const len = Math.min(highs.length, lows.length, closes.length, volumes.length);
  for (let i = 0; i < len; i++) {
    const tp = ((highs[i] ?? 0) + (lows[i] ?? 0) + (closes[i] ?? 0)) / 3;
    cumTPV += tp * (volumes[i] ?? 0);
    cumVol += volumes[i] ?? 0;
  }
  return cumVol > 0 ? cumTPV / cumVol : 0;
}

// ===== Bollinger Bantları =====
export function calculateBollingerBands(closes: number[], period = 20, stdDev = 2): { upper: number; middle: number; lower: number } | null {
  if (!closes || closes.length < period) return null;
  const slice = closes.slice(-period);
  const mean = slice.reduce((s, v) => s + v, 0) / period;
  const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return {
    upper: mean + sd * stdDev,
    middle: mean,
    lower: mean - sd * stdDev,
  };
}
