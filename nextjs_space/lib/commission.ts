export function commissionRate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 0.01) {
    throw new Error('Profil komisyon oranı geçersiz. Profil ayarınızı kontrol edin.');
  }
  return value;
}
export function commissionLabel(value: number): string {
  return `%${(value * 100).toLocaleString('tr-TR', { maximumFractionDigits: 4 })}`;
}
