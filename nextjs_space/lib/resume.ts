import { BIST_ALL_ASSETS, CRYPTO_ASSETS } from './constants';
import { validJourneySymbol } from './first-steps';
const symbols = new Set([...BIST_ALL_ASSETS, ...CRYPTO_ASSETS].map(asset => asset.symbol));
export type ResumeItem = { href: string; title: string; at: number };
export type ResumeState = { stock?: ResumeItem; course?: ResumeItem; hidden?: boolean };
const key = (id: string) => `borsabi-resume-v1:${id}`;
export function safeResume(item: unknown, kind: 'stock' | 'course'): item is ResumeItem {
  const v = item as ResumeItem | null;
  if (!v || typeof v.title !== 'string' || v.title.length > 160 || !Number.isFinite(v.at) || v.at <= 0 || typeof v.href !== 'string') return false;
  if (kind === 'course') return /^\/academy\/[a-z0-9-]+$/.test(v.href);
  try { const symbol = decodeURIComponent(v.href.slice(7)); return v.href.startsWith('/stock/') && validJourneySymbol(symbol) && symbols.has(symbol); } catch { return false; }
}
export function readResume(id: string): ResumeState {
  try { const v = JSON.parse(localStorage.getItem(key(id)) || '{}'); return { stock: safeResume(v?.stock, 'stock') ? v.stock : undefined, course: safeResume(v?.course, 'course') ? v.course : undefined, hidden: v?.hidden === true }; } catch { return {}; }
}
export function updateResume(id: string, patch: Partial<ResumeState>) {
  if (!id) return;
  const value = { ...readResume(id), ...patch };
  try { localStorage.setItem(key(id), JSON.stringify(value)); } catch {}
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('borsabi-resume', { detail: { id, value } }));
}
export function courseProgressKey(id: string, course: string) { return `borsabi-course-v1:${id}:${course}`; }
export function parseCourseProgress(raw: string | null, length: number) {
  try {
    const v = JSON.parse(raw || '{}');
    const valid = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < length;
    return { active: valid(v.active) ? v.active : 0, completed: Array.isArray(v.completed) ? [...new Set<number>(v.completed.filter(valid))] : [] };
  } catch { return { active: 0, completed: [] as number[] }; }
}
