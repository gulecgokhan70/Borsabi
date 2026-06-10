export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { cachedQuoteBatch } from '@/lib/yahoo-finance';
import { getMidasStockMap, getMidasForex, type MidasStock } from '@/lib/midas-api';
import { BIST_ALL_ASSETS } from '@/lib/constants';

// BIST sembol adı lookup
const nameMap = new Map<string, string>();
for (const a of BIST_ALL_ASSETS) {
  nameMap.set(`${a.symbol}.IS`, a.name);
  nameMap.set(a.symbol, a.name);
}

function isBistSymbol(sym: string): boolean {
  return sym.endsWith('.IS');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols');
    
    if (!symbols) {
      return NextResponse.json({ error: 'symbols parameter required' }, { status: 400 });
    }

    const symbolList = symbols.split(',').map((s: string) => s.trim());
    // Endeksler (XU100, XU030 vb.) Midas'ta yok, Yahoo'dan al
    const INDEX_SYMBOLS = ['XU100.IS', 'XU030.IS', 'XU050.IS'];
    const isIndex = (s: string) => INDEX_SYMBOLS.includes(s.toUpperCase());
    const bistSymbols = symbolList.filter(s => isBistSymbol(s) && !isIndex(s));
    const otherSymbols = symbolList.filter(s => !isBistSymbol(s) || isIndex(s));

    // Midas'tan BIST verilerini al (primary)
    let midasMap = new Map<string, MidasStock>();
    let midasOk = false;
    if (bistSymbols.length > 0) {
      try {
        midasMap = await getMidasStockMap();
        midasOk = midasMap.size > 0;
        if (midasOk) console.log(`[Market] Midas: ${midasMap.size} hisse`);
      } catch (e) {
        console.warn('[Market] Midas başarısız, Yahoo fallback kullanılacak');
      }
    }

    // Yahoo'dan fallback verileri al (BIST için Midas başarısızsa + diğer semboller)
    const yahooNeeded = midasOk ? otherSymbols : symbolList;
    let yahooMap = new Map<string, any>();
    if (yahooNeeded.length > 0) {
      try {
        yahooMap = await cachedQuoteBatch(yahooNeeded);
      } catch (e) {
        console.warn('[Market] Yahoo fallback hatası:', e);
      }
    }

    const results = symbolList.map((sym: string) => {
      const cleanSym = sym.replace('.IS', '').toUpperCase();
      const midas = midasOk && isBistSymbol(sym) && !isIndex(sym) ? midasMap.get(cleanSym) : null;

      if (midas) {
        // Midas verisinden oluştur - Last > Close > PreviousClose fallback
        const price = midas.Last || midas.Close || midas.PreviousClose || 0;
        const isOpen = (midas.Last > 0 && midas.TotalVolume > 0);
        return {
          symbol: sym,
          name: nameMap.get(sym) || nameMap.get(cleanSym) || cleanSym,
          price,
          change: midas.DailyChange ?? 0,
          changePercent: midas.DailyChangePercent ?? 0,
          volume: midas.TotalVolume ?? 0,
          high: midas.High || midas.PreviousClose || 0,
          low: midas.Low || midas.PreviousClose || 0,
          open: midas.Open || midas.PreviousClose || 0,
          prevClose: midas.PreviousClose ?? 0,
          marketCap: midas.MarketValue ?? 0,
          currency: 'TRY',
          marketOpen: isOpen,
          source: 'midas',
        };
      }

      // Yahoo fallback
      const q: any = yahooMap.get(sym);
      if (!q) return { symbol: sym, name: nameMap.get(sym) || sym, price: 0, change: 0, changePercent: 0, volume: 0, high: 0, low: 0, open: 0, prevClose: 0, marketCap: 0, currency: 'TRY', error: true, source: 'none' };
      const rawPrice = q?.regularMarketPrice ?? 0;
      const price = rawPrice > 0 ? rawPrice : (q?.regularMarketPreviousClose ?? 0);
      return {
        symbol: sym,
        name: nameMap.get(sym) || (q?.shortName ?? q?.longName ?? sym),
        price,
        change: q?.regularMarketChange ?? 0,
        changePercent: q?.regularMarketChangePercent ?? 0,
        volume: q?.regularMarketVolume ?? 0,
        high: q?.regularMarketDayHigh ?? 0,
        low: q?.regularMarketDayLow ?? 0,
        open: q?.regularMarketOpen ?? 0,
        prevClose: q?.regularMarketPreviousClose ?? 0,
        marketCap: q?.marketCap ?? 0,
        currency: q?.currency ?? 'TRY',
        marketOpen: rawPrice > 0,
        source: 'yahoo',
      };
    });

    const anyMarketOpen = results.some((r: any) => r.marketOpen === true);
    return NextResponse.json({ data: results, marketOpen: anyMarketOpen }, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (error: any) {
    console.error('Market API error:', error);
    return NextResponse.json({ error: 'Piyasa verileri alınamadı' }, { status: 500 });
  }
}
