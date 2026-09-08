import type { Position } from '@prisma/client';
import { getMarketQuotes, normalizeMarketSymbol } from './market-quotes';
import { getUsdTryRate } from './fx';
import { CurrencyError, entryCostTry, quoteCurrency, toTry } from './currency';

// Prices and stop levels stay in the instrument currency; every aggregate is TRY.
export async function valuePositions(positions: Position[]) {
  for (const position of positions) entryCostTry(position);
  const [quotes, fx] = await Promise.all([
    positions.length ? getMarketQuotes(positions.map(p => p.symbol)) : Promise.resolve([]),
    positions.some(p => p.type === 'CRYPTO') ? getUsdTryRate() : Promise.resolve(null),
  ]);
  const prices = new Map(quotes.map(q => [q.symbol, q]));
  return positions.map(position => {
    const currency = quoteCurrency(position.type);
    const quote = prices.get(normalizeMarketSymbol(position.symbol));
    const validQuote = quote && !quote.error && quote.currency === currency && Number.isFinite(quote.price) && quote.price > 0;
    if (quote && !quote.error && quote.currency !== currency) throw new CurrencyError('Fiyat kaynağının para birimi doğrulanamadı.');
    const currentPrice = validQuote ? quote.price : (position.currentPrice || position.entryPrice);
    const fxRate = position.type === 'CRYPTO' ? fx!.rate : 1;
    const currentPriceTry = toTry(currentPrice, fxRate);
    const entryPriceTry = entryCostTry(position);
    const totalValue = currentPriceTry * position.quantity;
    const totalCost = entryPriceTry * position.quantity + position.commission;
    const pnl = totalValue - totalCost;
    return { ...position, currency, currentPrice, currentPriceTry, entryPriceTry, fxRate,
      fxAsOf: position.type === 'CRYPTO' ? fx!.asOf : null, priceStale: !validQuote,
      totalValue, totalCost, pnl, pnlPercent: totalCost > 0 ? pnl / totalCost * 100 : 0 };
  });
}
