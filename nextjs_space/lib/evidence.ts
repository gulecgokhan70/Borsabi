export type EvidenceSource = { label: string; url: string; asOf: string | null; status: string };
export function evidenceHeader(sources: EvidenceSource[]) {
  const selected: EvidenceSource[] = [];
  for (const source of sources) {
    if (encodeURIComponent(JSON.stringify([...selected, source])).length > 6000) break;
    selected.push(source);
  }
  return encodeURIComponent(JSON.stringify(selected));
}
export function sourceTime(value: unknown): string | null {
  if (value == null) return null;
  const date = new Date(typeof value === 'number' ? value * 1000 : String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
export function safeSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function priceSource(label: string, symbol: string, time: unknown): EvidenceSource {
  const asOf = sourceTime(time), age = asOf ? Date.now() - Date.parse(asOf) : Infinity;
  return { label, url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/`, asOf,
    status: !asOf ? 'Fiyatın kaynak zamanı bilinmiyor; anlık olduğu doğrulanmadı.' : age > 120_000 ? 'Son bilinen fiyat; gecikmiş veya piyasa kapalı olabilir.' : 'Kaynak zaman damgası mevcut; gecikme olabilir.' };
}
