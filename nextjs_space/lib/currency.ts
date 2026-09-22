export type FxQuote = { rate: number; asOf: Date };
export class CurrencyError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}
export function quoteCurrency(marketType: string) { return marketType === 'CRYPTO' ? 'USD' : 'TRY'; }
export function toTry(price: number, rate: number) {
  const converted = price * rate;
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(rate) || rate <= 0 ||
      !Number.isFinite(converted) || converted <= 0 || converted > Number.MAX_SAFE_INTEGER) {
    throw new CurrencyError('Geçerli fiyat veya USD/TL kuru alınamadı. Lütfen tekrar deneyin.');
  }
  return converted;
}
export function entryCostTry(position: { type: string; entryPrice: number; entryPriceTry?: number | null }) {
  if (position.entryPriceTry != null) return toTry(position.entryPriceTry, 1);
  if (position.type !== 'CRYPTO') return toTry(position.entryPrice, 1);
  throw new CurrencyError('Eski kripto pozisyonunda kur kaydı eksik. İşlem geçmişinin incelenmesi gerekiyor.', 409);
}

// Cash controls floor quantities so the preview never spends beyond the chosen TL amount.
export function quantityForCash(cash: number, unitPriceTry: number, commissionRate: number, crypto: boolean) {
  if (![cash, unitPriceTry, commissionRate].every(Number.isFinite) || cash <= 0 || unitPriceTry <= 0 || commissionRate < 0) return 0;
  const quantity = cash / (unitPriceTry * (1 + commissionRate));
  return crypto ? Math.floor(quantity * 1e8) / 1e8 : Math.floor(quantity);
}
