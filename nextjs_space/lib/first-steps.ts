export type FirstStepsState = { symbol?: string; reviewed?: boolean; dismissed?: boolean };
const key = (accountId: string) => `borsabi-first-steps-v1:${accountId}`;
export function validJourneySymbol(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9.^=-]{1,32}$/.test(value);
}
export function readFirstSteps(accountId: string): FirstStepsState {
  try {
    const value = JSON.parse(localStorage.getItem(key(accountId)) || '{}');
    return { symbol: validJourneySymbol(value?.symbol) ? value.symbol : undefined, reviewed: value?.reviewed === true, dismissed: value?.dismissed === true };
  } catch { return {}; }
}
export function updateFirstSteps(accountId: string, patch: FirstStepsState) {
  if (!accountId) return;
  const state = { ...readFirstSteps(accountId), ...patch };
  if (!validJourneySymbol(state.symbol)) delete state.symbol;
  try { localStorage.setItem(key(accountId), JSON.stringify(state)); } catch { /* Optional browser storage. */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('borsabi-first-steps', { detail: { accountId, state } }));
}
export function firstStepsProgress(state: FirstStepsState, buyCount: number) {
  const traded = Number.isFinite(buyCount) && buyCount > 0;
  return [!!state.symbol || traded, traded, traded && state.reviewed === true];
}
