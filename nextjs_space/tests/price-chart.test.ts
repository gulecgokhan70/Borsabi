import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../hooks/use-haptic', () => ({ useHaptic: () => ({ light: vi.fn() }) }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => children,
  AreaChart: ({ children }: any) => createElement('section', null, children),
  Area: () => null, YAxis: () => null,
}));
import { PriceChart } from '../components/price-chart';
import { Area, AreaChart } from 'recharts';
let renderer: ReactTestRenderer;
afterEach(async () => { await act(async () => renderer?.unmount()); vi.unstubAllGlobals(); });

it('uses daily candles and previous close even when the intraday line slopes down', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ ohlc: [{ close: 230 }, { close: 211.7 }], chartPreviousClose: 209 }));
  vi.stubGlobal('fetch', fetcher);
  await act(async () => { renderer = create(createElement(PriceChart, { symbol: 'XU100.IS', period: '1d' })); });
  expect(fetcher.mock.calls[0][0]).toBe('/api/stock/XU100.IS?period=1d&interval=5m');
  expect(renderer.root.findByType(Area as any).props.stroke).toBe('#22C55E');
  expect(renderer.root.findByType(Area as any).props.type).toBe('linear');
  expect(renderer.root.findByType(AreaChart).props.data.map((p: any) => p.close)).toEqual([230, 211.7]);
  expect(JSON.stringify(renderer.toJSON())).toContain('Günlük grafik');
});

it('honours a monthly range and clears old data if refreshing fails', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ data: [{ close: 230 }, { close: 211.7 }] }))
    .mockResolvedValueOnce(new Response('', { status: 503 }));
  vi.stubGlobal('fetch', fetcher);
  await act(async () => { renderer = create(createElement(PriceChart, { symbol: 'XU100.IS', period: '1mo', refreshKey: 'first' })); });
  expect(fetcher.mock.calls[0][0]).toBe('/api/market/history?symbol=XU100.IS&period=1mo');
  expect(renderer.root.findByType(Area as any).props.stroke).toBe('#EF4444');
  await act(async () => { renderer.update(createElement(PriceChart, { symbol: 'XU100.IS', period: '1mo', refreshKey: 'second' })); });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  expect(renderer.root.findAllByType(Area as any)).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).toContain('Veri yok');
});

it('does not invent a daily change when the previous close is unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ohlc: [{ close: 230 }, { close: 211.7 }] })));
  await act(async () => { renderer = create(createElement(PriceChart, { symbol: 'XU030.IS', period: '1d' })); });
  expect(renderer.root.findByType(Area as any).props.stroke).toBe('#94A3B8');
  expect(JSON.stringify(renderer.toJSON())).toContain('Referans fiyat yok');
});
