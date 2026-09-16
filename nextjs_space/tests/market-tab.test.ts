import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../hooks/use-visible-poll', () => ({ useVisiblePoll: vi.fn() }));
import { useMarketTab, marketGroups } from '../hooks/use-market-tab';
let renderer: ReactTestRenderer;
let state: ReturnType<typeof useMarketTab>;
function Harness({ tab }: { tab: keyof typeof marketGroups }) { state = useMarketTab(tab); return null; }
afterEach(async () => { await act(async () => renderer?.unmount()); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('requests only the selected tab and ignores late results from the previous tab', async () => {
  let release!: (r: Response) => void;
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes('currencies')) return new Promise<Response>(resolve => { release = resolve; });
    return Response.json({ crypto: [{ symbol: 'BTC-USD', price: 123 }] });
  });
  vi.stubGlobal('fetch', fetcher);
  await act(async () => { renderer = create(createElement(Harness, { tab: 'doviz' })); });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe('/api/piyasalar?group=currencies');
  await act(async () => { renderer.update(createElement(Harness, { tab: 'kripto' })); });
  expect(state.data.crypto[0].price).toBe(123);
  await act(async () => { release(Response.json({ currencies: [{ price: 1 }] })); });
  expect(state.data).not.toHaveProperty('currencies');
  expect(state.loading).toBe(false);
});
it('shows index prices before optional chart history is available', async () => {
  let history!: (r: Response) => void;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('history=1')) return new Promise<Response>(resolve => { history = resolve; });
    return Response.json({ indices: [{ symbol: 'XU100.IS', price: 100, sparkline: [] }] });
  }));
  await act(async () => { renderer = create(createElement(Harness, { tab: 'endeks' })); });
  expect(state.data.indices[0].price).toBe(100);
  expect(state.loading).toBe(false);
  await act(async () => { history(Response.json({ indices: [{ symbol: 'XU100.IS', price: 50, sparkline: [1, 2] }] })); });
  expect(state.data.indices[0]).toMatchObject({ price: 100, sparkline: [1, 2] });
});
it('keeps existing data on refresh failure and exposes an actionable error', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ currencies: [{ price: 40 }] })).mockRejectedValueOnce(new Error('offline'));
  vi.stubGlobal('fetch', fetcher);
  await act(async () => { renderer = create(createElement(Harness, { tab: 'doviz' })); });
  await act(async () => { await state.fetchData(); });
  expect(state.data.currencies[0].price).toBe(40);
  expect(state.error).toContain('Yeniden deneyebilirsin');
  expect(state.loading).toBe(false);
});
