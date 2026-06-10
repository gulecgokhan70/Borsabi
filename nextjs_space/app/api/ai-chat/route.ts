export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BIST_ALL_STOCKS, BIST_TOP_STOCKS, CRYPTO_ASSETS, BIST_INDICES } from '@/lib/constants';
import { getMidasStock, getMidasStockMap } from '@/lib/midas-api';
import { cachedQuote, cachedChart } from '@/lib/yahoo-finance';
import { prisma } from '@/lib/db';

// ============================
// Teknik Gösterge Hesaplamaları
// ============================
function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
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

function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [data[0]];
  const k = 2 / (period + 1);
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } | null {
  if (closes.length < 35) return null;
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12.map((v: number, i: number) => v - ema26[i]);
  const signalLine = calculateEMA(macdLine.slice(25), 9);
  const lastMacd = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  return {
    macd: Math.round(lastMacd * 1000) / 1000,
    signal: Math.round(lastSignal * 1000) / 1000,
    histogram: Math.round((lastMacd - lastSignal) * 1000) / 1000,
  };
}

function calculateBollingerBands(closes: number[], period = 20): { upper: number; middle: number; lower: number } | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const avg = slice.reduce((a: number, b: number) => a + b, 0) / period;
  const variance = slice.reduce((a: number, b: number) => a + Math.pow(b - avg, 2), 0) / period;
  const std = Math.sqrt(variance);
  return {
    upper: Math.round((avg + 2 * std) * 100) / 100,
    middle: Math.round(avg * 100) / 100,
    lower: Math.round((avg - 2 * std) * 100) / 100,
  };
}

// ============================
// Sembol Algılama
// ============================
interface DetectedAsset {
  symbol: string;      // Yahoo format: THYAO.IS, BTC-USD
  shortName: string;   // Display: THYAO, BTC
  name: string;        // Full: Türk Hava Yolları, Bitcoin
  type: 'bist' | 'crypto' | 'index';
}

function detectSymbols(message: string): DetectedAsset[] {
  const upper = message.toUpperCase();
  const found: DetectedAsset[] = [];
  const seen = new Set<string>();

  // Check BIST stocks
  for (const s of BIST_ALL_STOCKS) {
    const short = s.shortName.toUpperCase();
    // Word boundary check - must be surrounded by non-letter chars or at edges
    const regex = new RegExp(`(?:^|[^A-ZÇĞİÖŞÜa-zçğıöşü])${short}(?:[^A-ZÇĞİÖŞÜa-zçğıöşü]|$)`);
    if (regex.test(upper) && !seen.has(s.symbol)) {
      seen.add(s.symbol);
      found.push({ symbol: s.symbol, shortName: s.shortName, name: s.name, type: 'bist' });
    }
  }

  // Check crypto
  for (const c of CRYPTO_ASSETS) {
    const short = (c as any).shortName?.toUpperCase() || c.symbol.replace('-USD', '');
    const regex = new RegExp(`(?:^|[^A-Za-z])${short}(?:[^A-Za-z]|$)`);
    if (regex.test(upper) && !seen.has(c.symbol)) {
      seen.add(c.symbol);
      found.push({ symbol: c.symbol, shortName: short, name: c.name, type: 'crypto' });
    }
    // Also check full names like "bitcoin", "ethereum"
    if (upper.includes(c.name.toUpperCase()) && !seen.has(c.symbol)) {
      seen.add(c.symbol);
      found.push({ symbol: c.symbol, shortName: short, name: c.name, type: 'crypto' });
    }
  }

  // Check indices
  for (const idx of BIST_INDICES) {
    const names = [idx.name.toUpperCase(), idx.symbol.replace('.IS', '')];
    if (names.some((n: string) => upper.includes(n)) && !seen.has(idx.symbol)) {
      seen.add(idx.symbol);
      found.push({ symbol: idx.symbol, shortName: idx.symbol.replace('.IS', ''), name: idx.name, type: 'index' });
    }
  }
  // Also detect BIST 100 / bist100 pattern
  if (/BIST\s*100/.test(upper) && !seen.has('XU100.IS')) {
    seen.add('XU100.IS');
    found.push({ symbol: 'XU100.IS', shortName: 'XU100', name: 'BIST 100', type: 'index' });
  }

  return found.slice(0, 5); // Max 5 symbols to avoid overload
}

// ============================
// Veri Çekme
// ============================
async function fetchStockData(asset: DetectedAsset): Promise<string> {
  try {
    const isBist = asset.type === 'bist';
    let price = 0, change = 0, changePercent = 0;
    let high = 0, low = 0, open = 0, prevClose = 0, volume = 0, marketCap = 0;
    let vwap: number | null = null, fk: number | null = null, pddd: number | null = null;
    let volatility: number | null = null;

    // Midas for BIST
    let midasOk = false;
    if (isBist) {
      try {
        const m = await getMidasStock(asset.symbol);
        if (m) {
          midasOk = true;
          price = m.Last || m.Close;
          change = m.DailyChange;
          changePercent = m.DailyChangePercent;
          high = m.High;
          low = m.Low;
          open = m.Open;
          prevClose = m.PreviousClose;
          volume = m.TotalVolume;
          marketCap = m.MarketValue;
          vwap = m.VWAP;
          fk = m.PriceEarning;
          pddd = m.PriceBookValue;
          volatility = m.Volatility;
        }
      } catch (_e) { /* fallback to Yahoo */ }
    }

    if (!midasOk) {
      try {
        const q = await cachedQuote(asset.symbol);
        if (q) {
          price = q.regularMarketPrice ?? 0;
          change = q.regularMarketChange ?? 0;
          changePercent = q.regularMarketChangePercent ?? 0;
          high = q.regularMarketDayHigh ?? 0;
          low = q.regularMarketDayLow ?? 0;
          open = q.regularMarketOpen ?? 0;
          prevClose = q.regularMarketPreviousClose ?? 0;
          volume = q.regularMarketVolume ?? 0;
          marketCap = q.marketCap ?? 0;
        }
      } catch (_e) { /* skip */ }
    }

    // Fetch 3-month chart for indicators
    let rsi: number | null = null;
    let macdData: { macd: number; signal: number; histogram: number } | null = null;
    let bb: { upper: number; middle: number; lower: number } | null = null;
    let ema20: number | null = null, ema50: number | null = null, ema200: number | null = null;

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(endDate.getMonth() - 12); // 1 year for EMA200
      const chartResult: any = await cachedChart(asset.symbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d',
      });
      const closes = (chartResult?.quotes ?? [])
        .map((q: any) => q?.close)
        .filter((c: any) => c != null && c > 0) as number[];

      if (closes.length > 14) rsi = Math.round(calculateRSI(closes) * 100) / 100;
      if (closes.length > 20) {
        const e20 = calculateEMA(closes, 20);
        ema20 = Math.round(e20[e20.length - 1] * 100) / 100;
      }
      if (closes.length > 50) {
        const e50 = calculateEMA(closes, 50);
        ema50 = Math.round(e50[e50.length - 1] * 100) / 100;
      }
      if (closes.length > 200) {
        const e200 = calculateEMA(closes, 200);
        ema200 = Math.round(e200[e200.length - 1] * 100) / 100;
      }
      macdData = calculateMACD(closes);
      bb = calculateBollingerBands(closes);
    } catch (_e) { /* skip indicators */ }

    // Build context string
    const currency = isBist ? 'TL' : (asset.type === 'crypto' ? 'USD' : 'TL');
    const lines: string[] = [
      `📊 ${asset.name} (${asset.shortName}) - Anlık Veri:`,
      `Fiyat: ${price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currency}`,
      `Değişim: ${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent >= 0 ? '+' : ''}%${changePercent.toFixed(2)})`,
      `Açılış: ${open.toFixed(2)} | Yüksek: ${high.toFixed(2)} | Düşük: ${low.toFixed(2)} | Önceki Kapanış: ${prevClose.toFixed(2)}`,
    ];
    if (volume > 0) lines.push(`Hacim: ${volume.toLocaleString('tr-TR')}`);
    if (marketCap > 0) lines.push(`Piyasa Değeri: ${(marketCap / 1e9).toFixed(2)} Milyar ${currency}`);
    if (vwap) lines.push(`VWAP: ${vwap.toFixed(2)}`);
    if (fk && fk > 0) lines.push(`F/K: ${fk.toFixed(2)}`);
    if (pddd && pddd > 0) lines.push(`PD/DD: ${pddd.toFixed(2)}`);
    if (volatility) lines.push(`Volatilite: %${volatility.toFixed(2)}`);

    lines.push('--- Teknik Göstergeler ---');
    if (rsi !== null) {
      const rsiYorum = rsi > 70 ? '(Aşırı Alım)' : rsi < 30 ? '(Aşırı Satım)' : '(Nötr)';
      lines.push(`RSI(14): ${rsi.toFixed(2)} ${rsiYorum}`);
    }
    if (ema20 !== null) lines.push(`EMA20: ${ema20.toFixed(2)} ${price > ema20 ? '(Fiyat üstünde ✅)' : '(Fiyat altında ⚠️)'}`);
    if (ema50 !== null) lines.push(`EMA50: ${ema50.toFixed(2)} ${price > ema50 ? '(Fiyat üstünde ✅)' : '(Fiyat altında ⚠️)'}`);
    if (ema200 !== null) lines.push(`EMA200: ${ema200.toFixed(2)} ${price > ema200 ? '(Uzun vadeli yükseliş ✅)' : '(Uzun vadeli düşüş ⚠️)'}`);
    if (macdData) {
      const macdYorum = macdData.histogram > 0 ? '(Yükseliş sinyali ✅)' : '(Düşüş sinyali ⚠️)';
      lines.push(`MACD: ${macdData.macd.toFixed(3)} | Sinyal: ${macdData.signal.toFixed(3)} | Histogram: ${macdData.histogram.toFixed(3)} ${macdYorum}`);
    }
    if (bb) {
      const bbPos = price > bb.upper ? '(Üst bant üstünde - aşırı alım)' :
        price < bb.lower ? '(Alt bant altında - aşırı satım)' : '(Bantlar arasında)';
      lines.push(`Bollinger: Üst=${bb.upper.toFixed(2)} | Orta=${bb.middle.toFixed(2)} | Alt=${bb.lower.toFixed(2)} ${bbPos}`);
    }

    return lines.join('\n');
  } catch (error: any) {
    console.error(`[AI] ${asset.shortName} veri hatası:`, error?.message);
    return `${asset.shortName}: Veri alınamadı`;
  }
}

async function fetchPortfolioData(userId: string): Promise<string> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true, initialBalance: true } });
    const positions = await prisma.position.findMany({ where: { userId, status: 'OPEN' }, orderBy: { openedAt: 'desc' } });
    const closedCount = await prisma.position.count({ where: { userId, status: 'CLOSED' } });

    if (!user) return 'Portföy verisi bulunamadı.';

    const balance = user.balance as number;
    const initialBalance = user.initialBalance as number;
    const totalPnl = balance - initialBalance;
    const totalPnlPercent = initialBalance > 0 ? ((totalPnl / initialBalance) * 100) : 0;

    const lines: string[] = [
      '💼 Kullanıcı Portföy Bilgisi:',
      `Bakiye: ${balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`,
      `Başlangıç: ${initialBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`,
      `Toplam Kar/Zarar: ${totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL (%${totalPnlPercent.toFixed(2)})`,
      `Açık Pozisyon: ${positions.length} | Kapatılmış: ${closedCount}`,
    ];

    if (positions.length > 0) {
      lines.push('--- Açık Pozisyonlar ---');
      // Güncel fiyatları çek
      const midasMap = await getMidasStockMap().catch(() => new Map());
      for (const p of positions.slice(0, 10)) {
        const sym = p.symbol;
        const shortSym = sym.replace('.IS', '').replace('-USD', '');
        let currentPrice = p.entryPrice as number;
        const cleanSym = sym.replace('.IS', '').toUpperCase();
        const midas = (midasMap as Map<string, any>).get(cleanSym);
        if (midas) {
          currentPrice = midas.Last || midas.Close || currentPrice;
        } else {
          try {
            const q = await cachedQuote(sym);
            if (q?.regularMarketPrice) currentPrice = q.regularMarketPrice;
          } catch (_e) { /* keep entry price */ }
        }
        const isShort = p.side === 'SHORT';
        const pnl = ((currentPrice - (p.entryPrice as number)) * (p.quantity as number)) * (isShort ? -1 : 1);
        const pnlPct = (p.entryPrice as number) > 0 ? ((currentPrice / (p.entryPrice as number) - 1) * 100) * (isShort ? -1 : 1) : 0;
        lines.push(`${shortSym}: ${p.side} ${(p.quantity as number)} lot @ ${(p.entryPrice as number).toFixed(2)} → ${currentPrice.toFixed(2)} (${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} TL, %${pnlPct.toFixed(2)})`);
      }
    }

    return lines.join('\n');
  } catch (error: any) {
    console.error('[AI] Portföy veri hatası:', error?.message);
    return 'Portföy verisi alınamadı.';
  }
}

// ============================
// Mesaj analizinde konu tespiti
// ============================
function detectTopics(message: string): { wantsPortfolio: boolean; wantsScreening: boolean; wantsGeneral: boolean } {
  const lower = message.toLowerCase();
  return {
    wantsPortfolio: /portföy|pozisyon|bakiye|kar.*zarar|zarar.*kar|hesab|risk.*merkez|açık pozisyon/i.test(lower),
    wantsScreening: /en iyi|en güçlü|tarama|hisse öner|hangi hisse|güçlü hisse|fırsat|alınır mı|yükselen/i.test(lower),
    wantsGeneral: !/portföy|pozisyon|bakiye|kar.*zarar|zarar.*kar|hesab|risk.*merkez|açık pozisyon/i.test(lower),
  };
}

async function fetchScreeningData(): Promise<string> {
  try {
    // Fetch top performing stocks from Midas
    const midasMap = await getMidasStockMap();
    const topStocks = BIST_TOP_STOCKS.slice(0, 10);
    const lines: string[] = ['📈 BIST En Likit 10 Hisse - Güncel Durum:'];

    for (const stock of topStocks) {
      const cleanSym = stock.shortName.toUpperCase();
      const m = midasMap.get(cleanSym);
      if (m) {
        const dir = m.DailyChangePercent >= 0 ? '🟢' : '🔴';
        lines.push(`${dir} ${stock.shortName}: ${(m.Last || m.Close).toFixed(2)} TL (%${m.DailyChangePercent >= 0 ? '+' : ''}${m.DailyChangePercent.toFixed(2)}) Hacim: ${m.TotalVolume?.toLocaleString('tr-TR') ?? '-'}`);
      }
    }

    return lines.join('\n');
  } catch (error: any) {
    console.error('[AI] Tarama veri hatası:', error?.message);
    return '';
  }
}

// ============================
// Ana Route Handler
// ============================
const SYSTEM_PROMPT_BASE = `Sen BorsaBi Trader platformunun yapay zeka asistanısın. Adın "BorsaBi AI".
Türkçe konuşuyorsun ve Türkiye piyasaları (BIST) ve kripto piyasaları konusunda uzmansın.

Görevlerin:
- Gerçek piyasa verilerini analiz etmek (sana sağlanan anlık veriler ile)
- Teknik analiz (RSI, MACD, EMA20/50/200, Bollinger Bantları)
- Temel analiz (F/K, PD/DD, piyasa değeri, hacim)
- Hisse ve kripto analizi
- Trend analizi ve destek/direnç seviyeleri
- Portföy değerlendirmesi ve risk yönetimi
- Eğitim ve strateji önerileri

ÖNEMLİ KURALLAR:
1. Her zaman Türkçe yanıt ver, Türkçe karakterleri doğru kullan (ç, ğ, ı, ö, ş, ü)
2. Sana sağlanan gerçek verileri temel alarak analiz yap. Veri sağlanmışsa, o verilerdeki rakamları kullan - uydurma rakam VERME
3. Teknik göstergeleri yorumla:
   - RSI > 70: Aşırı alım bölgesi, satış baskısı olabilir
   - RSI < 30: Aşırı satım bölgesi, alım fırsatı olabilir
   - MACD histogramı pozitif: Yükseliş momentumu
   - MACD histogramı negatif: Düşüş momentumu
   - Fiyat EMA20 üstünde: Kısa vadeli yükseliş trendi
   - Fiyat EMA50 üstünde: Orta vadeli yükseliş trendi
   - Fiyat EMA200 üstünde: Uzun vadeli yükseliş trendi
4. Risk uyarıları ver (işlem başına max %1-2 risk, günlük max %3 zarar limiti)
5. Destek ve direnç seviyelerini belirt (Bollinger bantları ve EMA seviyeleri referans)
6. Her yanıtın sonunda mutlaka şu uyarıyı ekle: "\n\n⚠️ Bu analiz yatırım tavsiyesi değildir. Eğitim ve simülasyon amaçlıdır."
7. Profesyonel, güven veren ve samimi bir üslup kullan
8. Rakamları ve yüzdeleri net olarak belirt
9. Eğer veri sağlanmamışsa, genel bilgi ver ama "güncel veri olmadan kesin bir şey söyleyemem" de
10. Yanıtları iyi formatla: emoji kullan, başlıklar ekle, okunabilir tut`;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Oturum gerekli' }), { status: 401 });
    }

    const body = await request.json();
    const { messages } = body ?? {};
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Mesajlar gerekli' }), { status: 400 });
    }

    const apiKey = process.env.ABACUSAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API anahtarı yapılandırılmamış' }), { status: 500 });
    }

    // Son kullanıcı mesajını al
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';

    // Sembol ve konu tespiti
    const detectedAssets = detectSymbols(lastUserMessage);
    const topics = detectTopics(lastUserMessage);
    const userId = (session.user as any).id;

    // Paralel veri çekme
    const dataPromises: Promise<string>[] = [];

    // Hisse/kripto verileri
    for (const asset of detectedAssets) {
      dataPromises.push(fetchStockData(asset));
    }

    // Portföy verisi
    if (topics.wantsPortfolio && userId) {
      dataPromises.push(fetchPortfolioData(userId));
    }

    // Tarama/screening verisi
    if (topics.wantsScreening && detectedAssets.length === 0) {
      dataPromises.push(fetchScreeningData());
    }

    const dataResults = await Promise.allSettled(dataPromises);
    const dataContext = dataResults
      .filter((r: any) => r.status === 'fulfilled' && r.value)
      .map((r: any) => r.value)
      .join('\n\n');

    // Sistem promptu oluştur
    let systemPrompt = SYSTEM_PROMPT_BASE;
    if (dataContext) {
      systemPrompt += `\n\n=== GÜNCEL PİYASA VERİLERİ (${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}) ===\n${dataContext}\n=== VERİ SONU ===\n\nYukarıdaki veriler gerçek zamanlı piyasa verileridir. Bu verileri temel alarak analiz yap. Verilerdeki rakamları aynen kullan, değiştirme veya uydurma.`;
    }

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...(messages ?? []).slice(-20),
    ];

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        messages: apiMessages,
        stream: true,
        max_tokens: 3000,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      console.error('LLM API error:', errText);
      return new Response(JSON.stringify({ error: 'AI yanıtı alınamadı' }), { status: 500 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        if (!reader) { controller.close(); return; }
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (error: any) {
          console.error('Stream error:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('AI Chat error:', error);
    return new Response(JSON.stringify({ error: 'AI asistan hatası' }), { status: 500 });
  }
}
