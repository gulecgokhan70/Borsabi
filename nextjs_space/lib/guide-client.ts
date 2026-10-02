import { guideKey, type GuideState } from './onboarding';
const dismissed = new Set<string>();
export function guideDismissed(accountId: string) {
  if (dismissed.has(accountId)) return true;
  try { return localStorage.getItem(`${guideKey(accountId)}:dismissed`) === 'true'; } catch { return false; }
}
export function dismissGuide(accountId: string) {
  dismissed.add(accountId);
  try { localStorage.setItem(`${guideKey(accountId)}:dismissed`, 'true'); } catch { /* Optional browser storage. */ }
}
export async function saveGuide(state: GuideState) {
  const response = await fetch('/api/onboarding', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state), keepalive: true, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('İlerleme kaydedilemedi. Tekrar deneyin.');
}
