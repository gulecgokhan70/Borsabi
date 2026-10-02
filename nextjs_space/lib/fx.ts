import { cachedQuote } from './yahoo-finance';
import { CurrencyError, toTry, type FxQuote } from './currency';

// Carry the last FX market quote across weekends, but reject an unbounded stale cache.
export const MAX_FX_AGE_MS = 4 * 24 * 60 * 60_000;
export async function getUsdTryRate(): Promise<FxQuote> {
  try {
    const quote = await cachedQuote('USDTRY=X');
    if (quote?.symbol !== 'USDTRY=X' || quote?.currency !== 'TRY') throw new Error('Unexpected FX pair');
    const rawTime = quote.regularMarketTime;
    const asOf = new Date(typeof rawTime === 'number' ? rawTime * 1000 : rawTime);
    const age = Date.now() - asOf.getTime();
    if (rawTime == null || !Number.isFinite(age) || age > MAX_FX_AGE_MS || age < -5 * 60_000) throw new Error('Stale FX quote');
    return { rate: toTry(quote.regularMarketPrice, 1), asOf };
  } catch {
    throw new CurrencyError('Güncel USD/TL kuru alınamadı. Kripto TL hesaplaması için lütfen daha sonra tekrar deneyin.');
  }
}
