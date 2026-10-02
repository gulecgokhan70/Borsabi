// Midas FreeFloatRate is expressed in percentage points, not a 0..1 ratio.
export function percentagePoints(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

export function profitFactorOf(pnls: number[]) {
  const gains = pnls.reduce((sum, pnl) => sum + Math.max(0, pnl), 0);
  const losses = pnls.reduce((sum, pnl) => sum + Math.max(0, -pnl), 0);
  return {
    profitFactor: losses > 0 ? gains / losses : null,
    profitFactorStatus: losses > 0 ? 'finite' as const : gains > 0 ? 'no-losses' as const : 'no-results' as const,
  };
}

export function tradeQuantityError(qty: number, type: 'BUY' | 'SELL', held: number, total: number, balance: number, crypto: boolean): string | null {
  if (!Number.isFinite(qty) || qty <= 0) return 'Sıfırdan büyük, geçerli bir miktar girin.';
  if (!crypto && !Number.isInteger(qty)) return 'Hisse işlemleri için tam adet girin.';
  if (type === 'SELL' && qty > held) return `En fazla ${held.toLocaleString('tr-TR', { maximumFractionDigits: 8 })} adet satabilirsiniz.`;
  if (!Number.isFinite(total) || total <= 0) return 'İşlem fiyatı ve kur bilgisi bekleniyor.';
  if (type === 'BUY' && total > balance + 0.000001) return 'Komisyon dahil tutar kullanılabilir bakiyenizi aşıyor.';
  return null;
}
