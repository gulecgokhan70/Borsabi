import type { AutoConfig, AutoState } from './auto-engine';
import { botCatalog } from './catalog';

export const PRIORITY_LIMIT = 12;
// Re-check promising rows, never reuse their old signal as an order instruction.
export function prioritySymbols(config: AutoConfig, state: AutoState, now: number): string[] {
  if (config.scope !== 'all' || state.paused || state.closeRequested) return [];
  const supported = new Set(botCatalog[config.market]);
  const protectedSymbols = new Set([...Object.keys(state.holdings), ...Object.keys(state.pending)]);
  return [...new Set(state.candidates
    .filter(row => supported.has(row.symbol) && !protectedSymbols.has(row.symbol) &&
      Number.isFinite(row.score) && row.score >= 40 && row.barTime > 0 && row.barTime <= now &&
      !!row.checkedAt && row.checkedAt <= now && now - row.checkedAt <= 30 * 60000)
    .sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol))
    .map(row => row.symbol))].slice(0, PRIORITY_LIMIT);
}

export function quoteAgeLabel(quoteTime: number | undefined, now: number): string {
  if (!quoteTime || !Number.isFinite(quoteTime)) return 'Fiyat zamanı bilinmiyor';
  if (quoteTime > now) return 'Fiyat zamanı geçersiz';
  const seconds = Math.floor((now - quoteTime) / 1000);
  return seconds < 60 ? `Fiyat yaşı: ${seconds} sn` : `Fiyat yaşı: ${Math.floor(seconds / 60)} dk`;
}
