export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cachedQuoteBatch, cachedChart } from '@/lib/yahoo-finance';
import { BIST_TOP_STOCKS, CRYPTO_ASSETS } from '@/lib/constants';
import { getMidasStockMap } from '@/lib/midas-api';
import { quoteMarketOpen, quoteTimestamp } from '@/lib/quote-metadata';

const INDEX_SYMBOLS = ['XU100.IS', 'XU030.IS', 'XU050.IS'];

const CURRENCY_PAIRS = [
  { symbol: 'USDTRY=X', name: 'Dolar / TL', shortName: 'USD/TRY', flag: '🇺🇸' },
  { symbol: 'EURTRY=X', name: 'Euro / TL', shortName: 'EUR/TRY', flag: '🇪🇺' },
  { symbol: 'GBPTRY=X', name: 'Sterlin / TL', shortName: 'GBP/TRY', flag: '🇬🇧' },
  { symbol: 'JPYTRY=X', name: 'Yen / TL', shortName: 'JPY/TRY', flag: '🇯🇵' },
  { symbol: 'CHFTRY=X', name: 'Frank / TL', shortName: 'CHF/TRY', flag: '🇨🇭' },
  { symbol: 'EURUSD=X', name: 'Euro / Dolar', shortName: 'EUR/USD', flag: '🇪🇺' },
];

const COMMODITY_SYMBOLS = [
  { symbol: 'GC=F', name: 'Altın (Ons)', shortName: 'Altın', icon: '🥇' },
  { symbol: 'SI=F', name: 'Gümüş (Ons)', shortName: 'Gümüş', icon: '🥈' },
  { symbol: 'BZ=F', name: 'Brent Petrol', shortName: 'Petrol', icon: '🛢️' },
  { symbol: 'NG=F', name: 'Doğal Gaz', shortName: 'Doğalgaz', icon: '🔥' },
];

async function getSparkline(symbol: string): Promise<number[]> {
  try {
    const data = await cachedChart(symbol, { period1: new Date(Math.floor(Date.now() / 3600000) * 3600000 - 2 * 86400000), period2: new Date(Math.floor(Date.now() / 3600000) * 3600000), interval: '1h' as any });
    const closes = (data?.quotes ?? []).map((q: any) => q?.close).filter((v: any) => v != null && !isNaN(v));
    if (closes.length > 20) {
      const step = Math.ceil(closes.length / 20);
      return closes.filter((_: any, i: number) => i % step === 0);
    }
    return closes;
  } catch { return []; }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const group = params.get('group');
  const groups = ['currencies', 'commodities', 'crypto', 'indices', 'bistStocks'];
  if (group && !groups.includes(group)) return NextResponse.json({ error: 'Geçersiz piyasa grubu' }, { status: 400 });
  const wants = (key: string) => !group || group === key;
  try {
    // Fetch all data in parallel
    const allCurrSymbols = CURRENCY_PAIRS.map(c => c.symbol);
    const allCommSymbols = COMMODITY_SYMBOLS.map(c => c.symbol);
    const cryptoSymbols = CRYPTO_ASSETS.map(c => c.symbol);

    const [currQuotes, commQuotes, cryptoQuotes, indexQuotes, midasRes] = await Promise.allSettled([
      wants('currencies') ? cachedQuoteBatch(allCurrSymbols) : wants('commodities') ? cachedQuoteBatch(['USDTRY=X']) : Promise.resolve(new Map()),
      wants('commodities') ? cachedQuoteBatch(allCommSymbols) : Promise.resolve(new Map()),
      wants('crypto') ? cachedQuoteBatch(cryptoSymbols) : Promise.resolve(new Map()),
      wants('indices') ? cachedQuoteBatch(INDEX_SYMBOLS) : Promise.resolve(new Map()),
      wants('bistStocks') ? getMidasStockMap() : Promise.resolve(new Map()),
    ]);

    const currData: Map<string, any> = currQuotes.status === 'fulfilled' ? currQuotes.value : new Map();
    const commData: Map<string, any> = commQuotes.status === 'fulfilled' ? commQuotes.value : new Map();
    const cryptoData: Map<string, any> = cryptoQuotes.status === 'fulfilled' ? cryptoQuotes.value : new Map();
    const indexData: Map<string, any> = indexQuotes.status === 'fulfilled' ? indexQuotes.value : new Map();
    const midasData = midasRes.status === 'fulfilled' ? midasRes.value : new Map();

    // Sparklines only for indices (fast, cached)
    const sparkSymbols = wants('indices') && params.get('history') === '1' ? INDEX_SYMBOLS : [];
    const sparkResults = await Promise.allSettled(sparkSymbols.map(s => getSparkline(s)));
    const sparkMap: Record<string, number[]> = {};
    sparkSymbols.forEach((s, i) => {
      sparkMap[s] = sparkResults[i].status === 'fulfilled' ? (sparkResults[i] as any).value : [];
    });

    // Format currencies
    const currencies = CURRENCY_PAIRS.map(cp => {
      const q: any = currData.get(cp.symbol) || {};
      return {
        symbol: cp.symbol,
        name: cp.name,
        shortName: cp.shortName,
        flag: cp.flag,
        price: q.regularMarketPrice ?? 0,
        change: q.regularMarketChange ?? 0,
        changePercent: q.regularMarketChangePercent ?? 0,
        high: q.regularMarketDayHigh ?? 0,
        low: q.regularMarketDayLow ?? 0,
        sparkline: sparkMap[cp.symbol] || [],
      };
    });

    // Format commodities
    const commodities = COMMODITY_SYMBOLS.map(cs => {
      const q: any = commData.get(cs.symbol) || {};
      return {
        symbol: cs.symbol,
        name: cs.name,
        shortName: cs.shortName,
        icon: cs.icon,
        price: q.regularMarketPrice ?? 0,
        change: q.regularMarketChange ?? 0,
        changePercent: q.regularMarketChangePercent ?? 0,
        currency: 'USD',
        sparkline: sparkMap[cs.symbol] || [],
      };
    });

    // Gram Altın ve Çeyrek Altın (TL) hesapla
    const goldQuote: any = commData.get('GC=F') || {};
    const usdTryQuote: any = currData.get('USDTRY=X') || {};
    const goldOnsUsd = goldQuote.regularMarketPrice ?? 0;
    const usdTry = usdTryQuote.regularMarketPrice ?? 0;
    const goldOnsChangePercent = goldQuote.regularMarketChangePercent ?? 0;
    const usdTryChangePercent = usdTryQuote.regularMarketChangePercent ?? 0;
    const combinedChangePercent = goldOnsChangePercent + usdTryChangePercent;

    if (goldOnsUsd > 0 && usdTry > 0) {
      const gramAltin = (goldOnsUsd / 31.1035) * usdTry;
      const ceyrekAltin = gramAltin * 1.75;

      // Önceki kapanıştan tahmini değişim
      const prevGramAltin = gramAltin / (1 + combinedChangePercent / 100);
      const prevCeyrekAltin = ceyrekAltin / (1 + combinedChangePercent / 100);

      commodities.splice(1, 0,
        {
          symbol: 'GRAM-ALTIN',
          name: 'Gram Altın',
          shortName: 'Gram Altın',
          icon: '✨',
          price: Math.round(gramAltin * 100) / 100,
          change: Math.round((gramAltin - prevGramAltin) * 100) / 100,
          changePercent: Math.round(combinedChangePercent * 100) / 100,
          currency: 'TRY',
          sparkline: [] as number[],
        },
        {
          symbol: 'CEYREK-ALTIN',
          name: 'Çeyrek Altın',
          shortName: 'Çeyrek Altın',
          icon: '🪙',
          price: Math.round(ceyrekAltin * 100) / 100,
          change: Math.round((ceyrekAltin - prevCeyrekAltin) * 100) / 100,
          changePercent: Math.round(combinedChangePercent * 100) / 100,
          currency: 'TRY',
          sparkline: [] as number[],
        },
      );
    }

    // Format crypto
    const crypto = CRYPTO_ASSETS.map(ca => {
      const q: any = cryptoData.get(ca.symbol) || {};
      return {
        symbol: ca.symbol,
        name: ca.name,
        shortName: ca.shortName,
        price: q.regularMarketPrice ?? 0,
        change: q.regularMarketChange ?? 0,
        changePercent: q.regularMarketChangePercent ?? 0,
        marketCap: q.marketCap ?? 0,
        volume: q.regularMarketVolume ?? 0,
        sparkline: sparkMap[ca.symbol] || [],
      };
    });

    // Format indices
    const indices = INDEX_SYMBOLS.map(sym => {
      const q: any = indexData.get(sym) || {};
      const name = sym === 'XU100.IS' ? 'BIST 100' : sym === 'XU030.IS' ? 'BIST 30' : 'BIST 50';
      return {
        priceAsOf: quoteTimestamp(q.regularMarketTime), priceSource: 'Yahoo Finance',
        marketOpen: quoteMarketOpen(q.marketState), checkedAt: new Date().toISOString(),
        symbol: sym,
        name,
        price: q.regularMarketPrice ?? 0,
        change: q.regularMarketChange ?? 0,
        changePercent: q.regularMarketChangePercent ?? 0,
        high: q.regularMarketDayHigh ?? 0,
        low: q.regularMarketDayLow ?? 0,
        sparkline: sparkMap[sym] || [],
      };
    });

    // BIST hisseleri from Midas
    const bistStocks = BIST_TOP_STOCKS.map(s => {
      const code = s.symbol.replace('.IS', '');
      const m: any = midasData.get(code) || {};
      const price = m.Last || m.Close || m.PreviousClose || 0;
      const prevClose = m.PreviousClose || 0;
      const change = m.DailyChange || (prevClose > 0 && price > 0 ? price - prevClose : 0);
      const changePercent = m.DailyChangePercent || (prevClose > 0 && price > 0 ? ((price - prevClose) / prevClose) * 100 : 0);
      return {
        symbol: s.symbol,
        priceAsOf: m.Last === price ? quoteTimestamp(m.DateTime) : null, priceSource: 'Midas',
        marketOpen: null, checkedAt: new Date().toISOString(),
        name: s.name,
        shortName: s.shortName,
        price,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        volume: m.TotalVolume || 0,
      };
    });

    const result = { currencies, commodities, crypto, indices, bistStocks };
    const selected: Record<string, { price: number; [key: string]: any }[]> = Object.fromEntries(Object.entries(result).filter(([key]) => wants(key)));
    let unavailable = 0;
    for (const [key, rows] of Object.entries(selected)) {
      const available = rows.filter(row => Number.isFinite(row.price) && row.price > 0);
      unavailable += rows.length - available.length;
      selected[key] = available;
    }
    // Never render missing provider prices as zero or describe a failed request as an empty market.
    if (Object.values(selected).every(rows => rows.length === 0)) return NextResponse.json({ error: 'Bu piyasanın verileri şu anda alınamıyor.' }, { status: 503 });
    return NextResponse.json({ ...selected, unavailable, checkedAt: new Date().toISOString() }, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    });
  } catch (e: any) {
    console.error('Piyasalar API error:', e);
    return NextResponse.json({ error: 'Veri alınamadı' }, { status: 500 });
  }
}
