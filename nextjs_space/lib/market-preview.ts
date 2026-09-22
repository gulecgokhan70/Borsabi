// Only public quotes are stored. Account balances, positions and chat never enter this cache.
export const PREVIEW_MAX_AGE = 5 * 60_000;
const keys = ['dashboard:indices', 'dashboard:stocks', 'dashboard:cryptos',
  'currencies', 'crypto', 'commodities', 'indices', 'bistStocks'] as const;
type PreviewKey = typeof keys[number];
type Preview = { rows: any[]; checkedAt: number };
const storageKey = (key: PreviewKey) => `borsabi-market-preview-v1:${key}`;

export function readMarketPreview(key: PreviewKey): Preview | null {
  try {
    if (!keys.includes(key)) return null;
    const saved = JSON.parse(sessionStorage.getItem(storageKey(key)) || 'null');
    const age = Date.now() - saved?.checkedAt;
    if (!saved || !Number.isFinite(age) || age < 0 || age > PREVIEW_MAX_AGE ||
        !Array.isArray(saved.rows) || !saved.rows.length || saved.rows.length > 2000 ||
        !saved.rows.every((row: any) => row && typeof row.symbol === 'string' && Number.isFinite(row.price) && row.price > 0)) {
      sessionStorage.removeItem(storageKey(key));
      return null;
    }
    return saved;
  } catch { return null; }
}

export function saveMarketPreview(key: PreviewKey, rows: any[], checkedAt: number) {
  try {
    if (!keys.includes(key) || !rows.length || rows.length > 2000 || !Number.isFinite(checkedAt)) return;
    // Keep source timestamps and display fields; exclude unavailable/error rows.
    const valid = rows.filter(row => row && !row.error && typeof row.symbol === 'string' && Number.isFinite(row.price) && row.price > 0);
    if (valid.length) sessionStorage.setItem(storageKey(key), JSON.stringify({ rows: valid, checkedAt }));
  } catch { /* Disabled/full browser storage must never block market loading. */ }
}
