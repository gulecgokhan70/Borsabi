// Mum Formasyonları Algılama (Candlestick Pattern Detection)

export interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface CandlePattern {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 1-3 (1=zayıf, 2=orta, 3=güçlü)
}

function bodySize(c: CandleData): number {
  return Math.abs(c.close - c.open);
}

function upperShadow(c: CandleData): number {
  return c.high - Math.max(c.open, c.close);
}

function lowerShadow(c: CandleData): number {
  return Math.min(c.open, c.close) - c.low;
}

function isBullish(c: CandleData): boolean {
  return c.close > c.open;
}

function isBearish(c: CandleData): boolean {
  return c.close < c.open;
}

function totalRange(c: CandleData): number {
  return c.high - c.low;
}

/**
 * Son N mumu analiz ederek mum formasyonlarını tespit eder.
 * @param candles - OHLC verileri (en eskiden en yeniye sıralı)
 * @returns Tespit edilen formasyonlar listesi
 */
export function detectCandlePatterns(candles: CandleData[]): CandlePattern[] {
  const patterns: CandlePattern[] = [];
  const len = candles.length;
  if (len < 3) return patterns;

  const c = candles[len - 1]; // Son mum
  const p = candles[len - 2]; // Önceki mum
  const pp = candles[len - 3]; // 2 önceki mum
  const range = totalRange(c);
  const body = bodySize(c);
  const upper = upperShadow(c);
  const lower = lowerShadow(c);

  if (range === 0) return patterns;

  // === TEK MUM FORMASYONLARI ===

  // Çekiç (Hammer) - Düşüş trendinde, uzun alt gölge, küçük gövde
  if (lower > body * 2 && upper < body * 0.5 && body > 0) {
    // Önceki 3 mumun trendi düşüş mü?
    if (len >= 5) {
      const trend = candles[len - 5].close > candles[len - 2].close;
      if (trend) {
        patterns.push({ name: 'Çekiç', type: 'bullish', strength: 2 });
      }
    }
  }

  // Ters Çekiç (Inverted Hammer) - Düşüş trendinde, uzun üst gölge, küçük gövde
  if (upper > body * 2 && lower < body * 0.5 && body > 0) {
    if (len >= 5) {
      const trend = candles[len - 5].close > candles[len - 2].close;
      if (trend) {
        patterns.push({ name: 'Ters Çekiç', type: 'bullish', strength: 1 });
      }
    }
  }

  // Kayan Yıldız (Shooting Star) - Yükseliş trendinde, uzun üst gölge
  if (upper > body * 2 && lower < body * 0.5 && body > 0) {
    if (len >= 5) {
      const trend = candles[len - 5].close < candles[len - 2].close;
      if (trend) {
        patterns.push({ name: 'Kayan Yıldız', type: 'bearish', strength: 2 });
      }
    }
  }

  // Doji - Çok küçük gövde, gölgeler gövdeden büyük
  if (body < range * 0.1 && range > 0) {
    if (upper > range * 0.25 && lower > range * 0.25) {
      patterns.push({ name: 'Doji', type: 'neutral', strength: 1 });
    }
  }

  // Yusufçuk Doji (Dragonfly Doji) - Gövde yok, uzun alt gölge
  if (body < range * 0.05 && lower > range * 0.7 && upper < range * 0.1) {
    patterns.push({ name: 'Yusufçuk Doji', type: 'bullish', strength: 2 });
  }

  // Mezar Taşı Doji (Gravestone Doji) - Gövde yok, uzun üst gölge
  if (body < range * 0.05 && upper > range * 0.7 && lower < range * 0.1) {
    patterns.push({ name: 'Mezar Taşı Doji', type: 'bearish', strength: 2 });
  }

  // Marubozu - Gövde neredeyse tüm mum, gölge yok
  if (body > range * 0.9) {
    if (isBullish(c)) {
      patterns.push({ name: 'Boğa Marubozu', type: 'bullish', strength: 2 });
    } else {
      patterns.push({ name: 'Ayı Marubozu', type: 'bearish', strength: 2 });
    }
  }

  // === İKİ MUM FORMASYONLARI ===

  const pBody = bodySize(p);
  const pRange = totalRange(p);

  // Boğa Yutan (Bullish Engulfing) - Önceki kırmızı mumu yeşil mum yutuyor
  if (isBearish(p) && isBullish(c) && c.open <= p.close && c.close >= p.open && body > pBody) {
    patterns.push({ name: 'Boğa Yutan', type: 'bullish', strength: 3 });
  }

  // Ayı Yutan (Bearish Engulfing) - Önceki yeşil mumu kırmızı mum yutuyor
  if (isBullish(p) && isBearish(c) && c.open >= p.close && c.close <= p.open && body > pBody) {
    patterns.push({ name: 'Ayı Yutan', type: 'bearish', strength: 3 });
  }

  // Kara Bulut Örtüsü (Dark Cloud Cover)
  if (isBullish(p) && isBearish(c) && c.open > p.high && c.close < (p.open + p.close) / 2 && c.close > p.open) {
    patterns.push({ name: 'Kara Bulut', type: 'bearish', strength: 2 });
  }

  // Delici Formasyon (Piercing Pattern)
  if (isBearish(p) && isBullish(c) && c.open < p.low && c.close > (p.open + p.close) / 2 && c.close < p.open) {
    patterns.push({ name: 'Delici Formasyon', type: 'bullish', strength: 2 });
  }

  // Harami (Bullish/Bearish)
  if (body > 0 && pBody > 0) {
    if (isBearish(p) && isBullish(c) && c.open > p.close && c.close < p.open && body < pBody * 0.6) {
      patterns.push({ name: 'Boğa Harami', type: 'bullish', strength: 1 });
    }
    if (isBullish(p) && isBearish(c) && c.open < p.close && c.close > p.open && body < pBody * 0.6) {
      patterns.push({ name: 'Ayı Harami', type: 'bearish', strength: 1 });
    }
  }

  // === ÜÇ MUM FORMASYONLARI ===

  const ppBody = bodySize(pp);

  // Sabah Yıldızı (Morning Star)
  if (isBearish(pp) && ppBody > 0 && bodySize(p) < ppBody * 0.4 && isBullish(c) && c.close > (pp.open + pp.close) / 2) {
    if (p.close < pp.close && p.open < pp.close) {
      patterns.push({ name: 'Sabah Yıldızı', type: 'bullish', strength: 3 });
    }
  }

  // Akşam Yıldızı (Evening Star)
  if (isBullish(pp) && ppBody > 0 && bodySize(p) < ppBody * 0.4 && isBearish(c) && c.close < (pp.open + pp.close) / 2) {
    if (p.close > pp.close && p.open > pp.close) {
      patterns.push({ name: 'Akşam Yıldızı', type: 'bearish', strength: 3 });
    }
  }

  // Üç Beyaz Asker (Three White Soldiers)
  if (isBullish(pp) && isBullish(p) && isBullish(c) && p.close > pp.close && c.close > p.close
    && ppBody > 0 && pBody > 0 && body > 0
    && upperShadow(pp) < ppBody * 0.3 && upperShadow(p) < pBody * 0.3 && upper < body * 0.3) {
    patterns.push({ name: 'Üç Beyaz Asker', type: 'bullish', strength: 3 });
  }

  // Üç Kara Karga (Three Black Crows)
  if (isBearish(pp) && isBearish(p) && isBearish(c) && p.close < pp.close && c.close < p.close
    && ppBody > 0 && pBody > 0 && body > 0
    && lowerShadow(pp) < ppBody * 0.3 && lowerShadow(p) < pBody * 0.3 && lower < body * 0.3) {
    patterns.push({ name: 'Üç Kara Karga', type: 'bearish', strength: 3 });
  }

  return patterns;
}

/**
 * Mum formasyonlarından bir skor hesaplar (-10 ile +10 arası)
 * Pozitif = boğa, Negatif = ayı
 */
export function candlePatternScore(patterns: CandlePattern[]): number {
  let score = 0;
  for (const p of patterns) {
    const pts = p.strength * (p.type === 'bullish' ? 3 : p.type === 'bearish' ? -3 : 0);
    score += pts;
  }
  return Math.max(-10, Math.min(10, score));
}
