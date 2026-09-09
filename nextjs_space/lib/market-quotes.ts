import { cachedQuoteBatch } from './yahoo-finance';
import { getMidasStockMap, type MidasStock } from './midas-api';
import { BIST_ALL_ASSETS, isIndexSymbol } from './constants';

const nameMap = new Map<string, string>();
for (const asset of BIST_ALL_ASSETS) {
  nameMap.set(asset.symbol.toUpperCase(), asset.name);
  nameMap.set(asset.symbol.replace(/\.IS$/, '').toUpperCase(), asset.name);
}
export function normalizeMarketSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  return !normalized.endsWith('.IS') && nameMap.has(normalized) ? `${normalized}.IS` : normalized;
}
function positivePrice(stock?: MidasStock) {
  return [stock?.Last, stock?.Close, stock?.PreviousClose].find(p => typeof p === 'number' && Number.isFinite(p) && p > 0) ?? 0;
}
function isBistSymbol(symbol: string) { return symbol.endsWith('.IS'); }
const isIndex = isIndexSymbol;

export async function getMarketQuotes(symbols: string[]) {
    const symbolList = [...new Set(symbols.map(normalizeMarketSymbol))];
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
    const yahooNeeded = otherSymbols.concat(bistSymbols.filter(s => !positivePrice(midasMap.get(s.replace(/\.IS$/, '')))));
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

      if (midas && positivePrice(midas)) {
        // Midas verisinden oluştur - Last > Close > PreviousClose fallback
        const price = positivePrice(midas);
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
      const price = [rawPrice, q?.regularMarketPreviousClose].find(p => Number.isFinite(p) && p > 0) ?? 0;
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
        error: price <= 0,
      };
    });

    return results;
}
