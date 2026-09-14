export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assetCurrency } from '@/lib/asset-display';
import { isIndexSymbol } from '@/lib/constants';
import { normalizeMarketSymbol } from '@/lib/market-quotes';
import { cachedChart } from '@/lib/yahoo-finance';
import { aiErrorResponse, getAIConfig, requestAICompletion } from '@/lib/ai-provider';

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function calcEMA(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const ema: number[] = [data[0]];
  const k = 2 / (period + 1);
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcMACD(closes: number[]) {
  if (closes.length < 35) return null;
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signal = calcEMA(macdLine.slice(-9), 9);
  const macd = macdLine[macdLine.length - 1];
  const sig = signal[signal.length - 1];
  return { macd, signal: sig, histogram: macd - sig };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const { symbol, name, price, change, changePercent, high, low, open, prevClose, volume, marketCap,
      fiftyTwoWeekHigh, fiftyTwoWeekLow, indicators, vwap, tavan, taban, fk, pddd,
      supportResistance, recentNews, currency } = await request.json();

    if (typeof symbol !== 'string' || !symbol) return new Response(JSON.stringify({ error: 'Symbol required' }), { status: 400 });
    const normalizedSymbol = normalizeMarketSymbol(symbol);
    const priceUnit = isIndexSymbol(normalizedSymbol) ? 'puan' : assetCurrency(normalizedSymbol, currency);

    getAIConfig();

    // Fetch historical data for analysis
    let ohlcData: any[] = [];
    try {
      const chart = await cachedChart(normalizedSymbol, { period1: new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0], period2: new Date().toISOString().split('T')[0], interval: '1d' as any });
      ohlcData = (chart?.quotes || []).filter((q: any) => q.close).map((q: any) => ({
        date: new Date(q.date).toLocaleDateString('tr-TR'),
        close: q.close, high: q.high, low: q.low, open: q.open, volume: q.volume
      }));
    } catch (e) {
      console.error('Chart fetch error for analysis:', e);
    }

    const closes = ohlcData.map((d: any) => d.close);
    const volumes = ohlcData.map((d: any) => d.volume || 0);
    const rsi = closes.length > 14 ? calcRSI(closes) : (indicators?.rsi ?? null);
    const macdData = closes.length > 35 ? calcMACD(closes) : null;
    const ema20 = closes.length > 20 ? calcEMA(closes, 20) : [];
    const ema50 = closes.length > 50 ? calcEMA(closes, 50) : [];
    const ema200 = closes.length > 200 ? calcEMA(closes, 200) : [];
    const avgVol = volumes.length > 20 ? volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20 : 0;
    const volRatio = avgVol > 0 && volume ? (volume / avgVol) : 1;

    // Son 20 günlük fiyat değişimi
    const priceChange20d = closes.length > 20 ? ((closes[closes.length - 1] - closes[closes.length - 21]) / closes[closes.length - 21] * 100) : null;
    // Son 5 günlük fiyat değişimi 
    const priceChange5d = closes.length > 5 ? ((closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6] * 100) : null;

    // Build prompt
    const dataContext = `
Varlık: ${normalizedSymbol} (${name || symbol})
Fiyat ve teknik seviyelerin birimi: ${priceUnit}. Tutarları başka bir para birimine çevirmeden bu birimle yorumla.
Fiyat: ${price} ${priceUnit} | Değişim: %${changePercent?.toFixed(2)} (${change?.toFixed(2)} ${priceUnit})
Açılış: ${open} | Yüksek: ${high} | Düşük: ${low} | Önceki Kapanış: ${prevClose}
Hacim: ${volume ? (volume > 1e6 ? (volume / 1e6).toFixed(1) + 'M' : volume.toLocaleString('tr-TR')) : 'N/A'}
Hacim Oranı (20 gün ort.): ${volRatio.toFixed(2)}x
Piyasa Değeri: ${marketCap ? (marketCap > 1e9 ? (marketCap / 1e9).toFixed(1) + ' Milyar ' + priceUnit : (marketCap / 1e6).toFixed(0) + ' Milyon ' + priceUnit) : 'N/A'}
52 Hafta Yüksek: ${fiftyTwoWeekHigh || 'N/A'} | 52 Hafta Düşük: ${fiftyTwoWeekLow || 'N/A'}
${tavan ? 'Tavan: ' + tavan + ' ' + priceUnit : ''} ${taban ? '| Taban: ' + taban + ' ' + priceUnit : ''}
${fk ? 'F/K: ' + fk.toFixed(1) : ''} ${pddd ? '| PD/DD: ' + pddd.toFixed(2) : ''}
${vwap ? 'VWAP: ' + vwap.toFixed(2) + ' ' + priceUnit : ''}

Teknik Göstergeler:
- RSI(14): ${rsi?.toFixed(1) ?? 'N/A'}
- EMA20: ${ema20.length ? ema20[ema20.length - 1].toFixed(2) : (indicators?.ema20?.toFixed(2) ?? 'N/A')}
- EMA50: ${ema50.length ? ema50[ema50.length - 1].toFixed(2) : (indicators?.ema50?.toFixed(2) ?? 'N/A')}
- EMA200: ${ema200.length ? ema200[ema200.length - 1].toFixed(2) : (indicators?.ema200?.toFixed(2) ?? 'N/A')}
- MACD: ${macdData ? macdData.macd.toFixed(3) : (indicators?.macd?.toFixed(3) ?? 'N/A')}
- MACD Sinyal: ${macdData ? macdData.signal.toFixed(3) : (indicators?.macdSignal?.toFixed(3) ?? 'N/A')}
- MACD Histogram: ${macdData ? macdData.histogram.toFixed(3) : (indicators?.macdHistogram?.toFixed(3) ?? 'N/A')}
${priceChange5d !== null ? '- 5 Günlük Değişim: %' + priceChange5d.toFixed(2) : ''}
${priceChange20d !== null ? '- 20 Günlük Değişim: %' + priceChange20d.toFixed(2) : ''}

Destek/Direnç Seviyeleri:
${supportResistance?.supports?.length ? 'Destekler: ' + supportResistance.supports.map((s: any) => s.price.toFixed(2) + ' ' + priceUnit).join(', ') : 'Destek bilgisi yok'}
${supportResistance?.resistances?.length ? 'Dirençler: ' + supportResistance.resistances.map((r: any) => r.price.toFixed(2) + ' ' + priceUnit).join(', ') : 'Direnç bilgisi yok'}
${recentNews?.length ? '\nSon Haberler ve KAP Bildirimleri:\n' + recentNews.map((n: any, i: number) => `${i + 1}. [${n.sentiment || 'nötr'}] [${n.category === 'kap' ? 'KAP' : 'Haber'}] ${n.title} (Kaynak: ${n.source})`).join('\n') : 'Son haber bulunamadı.'}
`;

    const systemPrompt = `Sen Borsa İstanbul ve kripto piyasaları için teknik analiz yapan bir asistansın. Türkçe yanıt ver.
Kullanıcıya verilen varlığın verileri ve güncel haberleri üzerinden kapsamlı bir teknik analiz yap. Fiyat birimini (${priceUnit}) koru.
Eğer haberler verilmişse, haberlerin fiyat üzerindeki olası etkisini de değerlendir.

JSON formatında yanıt ver. Aşağıdaki yapıyı kullan:
{
  "genel_gorunum": "Kısa genel değerlendirme (2-3 cümle)",
  "trend": "YUKARI" | "AŞAĞI" | "YATAY",
  "sinyal": "AL" | "SAT" | "BEKLE",
  "guven_skoru": 1-100 arası sayı,
  "teknik_analiz": {
    "trend_analizi": "EMA'lar ve fiyat hareketi üzerinden trend değerlendirmesi (2-3 cümle)",
    "momentum": "RSI ve MACD üzerinden momentum değerlendirmesi (2-3 cümle)",
    "hacim_analizi": "Hacim durumu ve ne ifade ettiği (1-2 cümle)",
    "destek_direnc": "Önemli destek/direnç seviyeleri ve yakın hedefler (2-3 cümle)"
  },
  "strateji": {
    "kisa_vade": "1-5 gün için strateji önerisi (1-2 cümle)",
    "orta_vade": "1-4 hafta için strateji önerisi (1-2 cümle)"
  },
  "haber_etkisi": {
    "ozet": "Haberlerin genel etkisi ve fiyata yansıması (2-3 cümle)",
    "duygu": "OLUMLU" | "OLUMSUZ" | "NÖTR",
    "onemli_gelismeler": ["Gelişme 1", "Gelişme 2"]
  },
  "riskler": ["Risk 1", "Risk 2", "Risk 3"],
  "onemli_seviyeler": {
    "destek1": sayı,
    "destek2": sayı,
    "direnc1": sayı,
    "direnc2": sayı
  }
}

ÖNEMLİ: Sadece teknik verilere dayalı analiz yap. Her zaman "Bu yatırım tavsiyesi değildir" uyarısını genel görünümün sonuna ekle. Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;

    const response = await requestAICompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Aşağıdaki varlık verilerini analiz et:\n${dataContext}` },
      ],
      stream: true, max_tokens: 3000, temperature: 0.3,
      response_format: { type: 'json_object' }, signal: request.signal,
    });

    // Stream back with buffering for JSON
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = '';
    let partialRead = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            partialRead += decoder.decode(value, { stream: true });
            const lines = partialRead.split('\n');
            partialRead = lines.pop() || '';
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  try {
                    const finalResult = JSON.parse(buffer);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'completed', result: finalResult })}\n\n`));
                  } catch {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'completed', result: { genel_gorunum: buffer, trend: 'YATAY', sinyal: 'BEKLE', guven_skoru: 50 } })}\n\n`));
                  }
                  controller.close();
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  buffer += parsed.choices?.[0]?.delta?.content || '';
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'processing' })}\n\n`));
                } catch { /* skip */ }
              }
            }
          }
          // If stream ended without [DONE]
          if (buffer) {
            try {
              const finalResult = JSON.parse(buffer);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'completed', result: finalResult })}\n\n`));
            } catch {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'completed', result: { genel_gorunum: buffer, trend: 'YATAY', sinyal: 'BEKLE', guven_skoru: 50 } })}\n\n`));
            }
          }
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'error', message: 'Analiz sırasında hata oluştu' })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return aiErrorResponse(error);
  }
}
