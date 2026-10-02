import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../hooks/use-visible-poll', () => ({ useVisiblePoll: vi.fn() }));
import { useDashboardData } from '../hooks/use-dashboard-data';
let state: ReturnType<typeof useDashboardData>;
let renderer: ReactTestRenderer;
function Harness() { state = useDashboardData(); return null; }
afterEach(async () => { await act(async () => renderer?.unmount()); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('reveals portfolio and stock data while a slow crypto request is still pending', async () => {
  let crypto!: (r: Response) => void;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('BTC-USD')) return new Promise<Response>(resolve => { crypto = resolve; });
    return Response.json(url === '/api/portfolio?summary=1' ? { balance: 123, accountId: 'u' } : { data: [{ price: 10 }], marketOpen: null });
  }));
  await act(async () => { renderer = create(createElement(Harness)); });
  let request!: Promise<void>;
  await act(async () => { request = state.fetchData(); });
  expect(state.portfolio.balance).toBe(123);
  expect(state.stocks[0].price).toBe(10);
  expect(state.pending.stocks).toBe(false);
  expect(state.pending.cryptos).toBe(true);
  await act(async () => { crypto(Response.json({ data: [{ price: 20 }] })); await request; });
  expect(state.loading).toBe(false);
  expect(state.cryptos[0].price).toBe(20);
});
it('expires stalled requests and does not replace missing balances with zero', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new Error('timeout'))))));
  await act(async () => { renderer = create(createElement(Harness)); });
  let request!: Promise<void>;
  await act(async () => { request = state.fetchData(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(20_001); await request; });
  expect(state.loading).toBe(false);
  expect(state.portfolio).toBe(null);
  expect(state.refreshError).toContain('yüklenemedi');
});
it('ignores an obsolete response after a newer refresh completes', async () => {
  let finish!: (r: Response) => void;
  let calls = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/portfolio?summary=1' && ++calls === 1) return new Promise<Response>(resolve => { finish = resolve; });
    return Response.json(url === '/api/portfolio?summary=1' ? { balance: 999 } : { data: [] });
  }));
  await act(async () => { renderer = create(createElement(Harness)); });
  let old!: Promise<void>;
  await act(async () => { old = state.fetchData(); });
  await act(async () => { await state.fetchData(); });
  await act(async () => { finish(Response.json({ balance: 1 })); await old; });
  expect(state.portfolio.balance).toBe(999);
});
