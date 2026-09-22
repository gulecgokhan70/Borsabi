import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { PREVIEW_MAX_AGE, readMarketPreview, saveMarketPreview } from '../lib/market-preview';
vi.mock('../hooks/use-visible-poll', () => ({ useVisiblePoll: vi.fn() }));
import { useMarketTab } from '../hooks/use-market-tab';
import { useDashboardData } from '../hooks/use-dashboard-data';
let storage: Map<string, string>;
let renderer: ReactTestRenderer;
let market: ReturnType<typeof useMarketTab>, dashboard: ReturnType<typeof useDashboardData>;
function Market() { market = useMarketTab('doviz'); return null; }
function Dashboard() { dashboard = useDashboardData(); return null; }
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('sessionStorage', { getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
});
afterEach(async () => { await act(async () => renderer?.unmount()); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('shows the previous list before the network returns, then replaces it without changing the saved timestamp early', async () => {
  const checkedAt = Date.now() - 40_000;
  saveMarketPreview('currencies', [{ symbol: 'USDTRY=X', price: 40 }], checkedAt);
  let finish!: (r: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
  await act(async () => { renderer = create(createElement(Market)); });
  expect(market.data.currencies[0].price).toBe(40);
  expect(market.preview).toBe(true);
  expect(market.lastUpdate).toBe(checkedAt);
  expect(market.loading).toBe(true);
  await act(async () => { finish(Response.json({ currencies: [{ symbol: 'USDTRY=X', price: 41 }], checkedAt: new Date().toISOString() })); });
  expect(market.data.currencies[0].price).toBe(41);
  expect(market.preview).toBe(false);
});
it('rejects expired, future, malformed and unavailable prices, and handles disabled storage', () => {
  for (const time of [Date.now() - PREVIEW_MAX_AGE - 1, Date.now() + 60000]) {
    saveMarketPreview('currencies', [{ symbol: 'USDTRY=X', price: 40 }], time);
    expect(readMarketPreview('currencies')).toBeNull();
  }
  storage.set('borsabi-market-preview-v1:currencies', '{invalid');
  expect(readMarketPreview('currencies')).toBeNull();
  saveMarketPreview('crypto', [{ symbol: 'BTC-USD', price: 0, error: true }], Date.now());
  expect(readMarketPreview('crypto')).toBeNull();
  vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } });
  expect(() => saveMarketPreview('crypto', [{ symbol: 'BTC-USD', price: 1 }], Date.now())).not.toThrow();
  expect(readMarketPreview('crypto')).toBeNull();
});
it('restores public dashboard rows, never account balances; summary loading is independent', async () => {
  saveMarketPreview('dashboard:stocks', [{ symbol: 'THYAO.IS', price: 300 }], Date.now());
  const fetcher = vi.fn(async (url: string) => Response.json(url.includes('portfolio') ? { balance: 42, accountId: 'new-user' } : { data: [{ symbol: 'X', price: 2 }] }));
  vi.stubGlobal('fetch', fetcher);
  await act(async () => { renderer = create(createElement(Dashboard)); });
  expect(dashboard.stocks[0].price).toBe(300);
  expect(dashboard.portfolio).toBeNull();
  await act(async () => { await dashboard.fetchData(); });
  expect(fetcher).toHaveBeenCalledWith('/api/portfolio?summary=1', expect.anything());
  expect(dashboard.portfolio.accountId).toBe('new-user');
  expect([...storage.values()].join('')).not.toContain('new-user');
  expect([...storage.values()].join('')).not.toContain('balance');
});
