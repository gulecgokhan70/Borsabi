import { quoteTimestamp } from './quote-metadata';

export type QuoteInfo = { priceAsOf?: string | null; priceSource?: string | null; checkedAt?: string | null; marketOpen?: boolean | null };
export function bistDataStatus(info: QuoteInfo, now: number) {
  const local = new Date(now + 3 * 3600000); // Europe/Istanbul is UTC+3.
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  const weekday = local.getUTCDay() > 0 && local.getUTCDay() < 6;
  const checked = quoteTimestamp(info.checkedAt, now);
  const recentCheck = checked && now - Date.parse(checked) <= 180000;
  // A clock is not a holiday calendar or a confirmation from the exchange.
  const session = recentCheck && info.marketOpen === false ? 'Piyasa kapalı (kaynağa göre)' :
    recentCheck && info.marketOpen === true && weekday && minute >= 580 && minute < 1090 ? 'Piyasa açık (kaynağa göre)' :
    'Seans durumu doğrulanmadı';
  const priceTime = quoteTimestamp(info.priceAsOf, now);
  const age = priceTime ? Math.max(0, now - Date.parse(priceTime)) : null;
  const opening = weekday && minute >= 600 && minute < 615 && !(recentCheck && info.marketOpen === false);
  const data = opening ? 'Açılış verileri bekleniyor' : age !== null && age > 25 * 60000
    ? 'Son bilinen fiyat gösteriliyor' : 'Veriler yaklaşık 15 dakika gecikmeli';
  return { session, data, detail: opening ? 'Normal açılış 10:00. Gecikmeli açılış verileri 10:15 civarında beklenir.' :
    '10:15 veri bekleme saatidir; borsanın açılış saati değildir. Tatil ve özel seanslar farklı olabilir.' };
}

export function bistSummary(rows: QuoteInfo[], now: number): QuoteInfo {
  const current = rows.filter(row => {
    const timestamp = quoteTimestamp(row.checkedAt, now);
    return timestamp && now - Date.parse(timestamp) <= 180000 && typeof row.marketOpen === 'boolean';
  });
  return { marketOpen: current.some(row => row.marketOpen === true) ? true :
    current.length > 0 && current.every(row => row.marketOpen === false) ? false : null,
    checkedAt: current.length ? current.map(row => row.checkedAt!).sort()[0] : null };
}
