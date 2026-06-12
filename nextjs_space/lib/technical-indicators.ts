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
export function calculateBollingerBands(closes: number[], period = 20, stdDev = 2): { upper: number; middle: number; lower: number; bandwidth: number } | null {
  if (!closes || closes.length < period) return null;
  const slice = closes.slice(-period);
  const mean = slice.reduce((s, v) => s + v, 0) / period;
  const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  const upper = mean + sd * stdDev;
  const lower = mean - sd * stdDev;
  return {
    upper,
    middle: mean,
    lower,
    bandwidth: mean > 0 ? ((upper - lower) / mean) * 100 : 0,
  };
}

// ===== Stochastic Oscillator =====
export function calculateStochastic(closes: number[], highs: number[], lows: number[], kPeriod = 14): { k: number; d: number } {
  if (!closes || closes.length < kPeriod) return { k: 50, d: 50 };
  const len = closes.length;
  const kValues: number[] = [];
  for (let i = Math.max(0, len - 5); i < len; i++) {
    const start = Math.max(0, i - kPeriod + 1);
    const hh = Math.max(...highs.slice(start, i + 1));
    const ll = Math.min(...lows.slice(start, i + 1));
    kValues.push(hh !== ll ? ((closes[i] - ll) / (hh - ll)) * 100 : 50);
  }
  const k = kValues[kValues.length - 1];
  const d = kValues.reduce((a, b) => a + b, 0) / kValues.length;
  return { k: Math.round(k * 100) / 100, d: Math.round(d * 100) / 100 };
}

// ===== ADX (Average Directional Index) =====
export function calculateADX(closes: number[], highs: number[], lows: number[], period = 14): { adx: number; plusDI: number; minusDI: number } {
  if (!closes || closes.length < period + 1) return { adx: 0, plusDI: 0, minusDI: 0 };
  const len = closes.length;
  let sumTR = 0, sumPlusDM = 0, sumMinusDM = 0;
  for (let i = 1; i <= Math.min(period, len - 1); i++) {
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    sumTR += tr;
    sumPlusDM += (upMove > downMove && upMove > 0 ? upMove : 0);
    sumMinusDM += (downMove > upMove && downMove > 0 ? downMove : 0);
  }
  let smoothTR = sumTR;
  let smoothPlusDM = sumPlusDM;
  let smoothMinusDM = sumMinusDM;
  const dxValues: number[] = [];
  for (let i = period + 1; i < len; i++) {
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    smoothTR = smoothTR - smoothTR / period + tr;
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + (upMove > downMove && upMove > 0 ? upMove : 0);
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + (downMove > upMove && downMove > 0 ? downMove : 0);
    const pDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const mDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    const dx = (pDI + mDI) > 0 ? (Math.abs(pDI - mDI) / (pDI + mDI)) * 100 : 0;
    dxValues.push(dx);
  }
  const adx = dxValues.length > 0 ? dxValues.slice(-period).reduce((a, b) => a + b, 0) / Math.min(period, dxValues.length) : 0;
  const lastPDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
  const lastMDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
  return { adx: Math.round(adx * 100) / 100, plusDI: Math.round(lastPDI * 100) / 100, minusDI: Math.round(lastMDI * 100) / 100 };
}
