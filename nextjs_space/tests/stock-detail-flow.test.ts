import { createElement, type ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// Keep React state, effects, the detail page and TradeModal real. Only replace
// navigation, chart drawing and animation, which need a browser layout engine.
vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn() }) }));
vi.mock('framer-motion', () => ({
  motion: { div: 'div' }, AnimatePresence: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('recharts', () => {
  const container = ({ children, onMouseMove }: any) => createElement('section', { onMouseMove }, children);
  return {
    ResponsiveContainer: container, ComposedChart: container,
    Bar: container, Line: () => null, Area: () => null, XAxis: () => null,
    YAxis: () => null, Tooltip: () => null, CartesianGrid: () => null,
    ReferenceLine: () => null, Cell: () => null,
  };
});
vi.mock('../components/chart-drawing-tools', () => ({ ChartDrawingToolbar: () => null, ChartDrawingOverlay: () => null }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import StockDetailClient from '../app/stock/[symbol]/stock-detail-client';
import { TradeModal } from '../components/trade-modal';
import { tradeSchema } from '../lib/trading';

let renderer: ReactTestRenderer | undefined;
let fxUnavailable = false;
let orderBody: any;
const fetchMock = vi.fn();
const fixture = (symbol: string) => ({
  symbol, shortName: symbol.split(/[.-]/)[0], name: 'Test varlığı',
  price: symbol.endsWith('-USD') ? 79315.5 : 315.5,
  currency: symbol.endsWith('-USD') ? 'USD' : 'TRY', change: -758.71, changePercent: -0.97,
  high: 80000, low: 78000, open: 79000, prevClose: 80074.21,
  volume: 100000, marketCap: 1589900000000, fiftyTwoWeekHigh: 100000, fiftyTwoWeekLow: 60000,
  indicators: { rsi: 50, ema20: 79000, ema50: 78000, ema200: 77000, avgVolume: 100000, macd: 1,
    macdSignal: 0, macdHistogram: 1, bbUpper: 81000, bbMiddle: 79000, bbLower: 77000 },
  supportResistance: { supports: [{ price: 75000, strength: 2 }], resistances: [{ price: 85000, strength: 2 }] },
  ohlc: [{ time: 100, date: new Date().toISOString(), open: 79000, high: 80000, low: 78000, close: 79300, volume: 10 }],
});

const textOf = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => textOf(child)).join('');
const button = (label: string) => renderer!.root.findAllByType('button').find(node => textOf(node).trim() === label)!;
const mount = async (symbol = 'BTC-USD') => {
  await act(async () => { renderer = create(createElement(StockDetailClient, { symbol })); });
};

beforeEach(() => {
  vi.useFakeTimers();
  fxUnavailable = false; orderBody = undefined;
  fetchMock.mockReset().mockImplementation(async (input: string, options?: RequestInit) => {
    if (input.startsWith('/api/stock/')) return Response.json(fixture(decodeURIComponent(input.split('/')[3].split('?')[0])));
    if (input.startsWith('/api/news')) return Response.json({ news: [] });
    if (input === '/api/portfolio') return Response.json({ balance: 100000, commissionRate: 0.002, positions: [] });
    if (input === '/api/fx') return fxUnavailable
      ? Response.json({ error: 'Kur alınamadı' }, { status: 503 })
      : Response.json({ rate: 32, asOf: new Date().toISOString() });
    if (input === '/api/trade') {
      orderBody = JSON.parse(String(options?.body));
      return Response.json({ error: 'Test isteği; kayıt yapılmadı' }, { status: 400 });
    }
    throw new Error(`Unexpected test request: ${input}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  await act(async () => { renderer?.unmount(); });
  renderer = undefined;
  vi.useRealTimers(); vi.unstubAllGlobals();
});

it('renders BTC detail quotes and chart-selected changes in USD, then budgets 1000 TRY in the real buy modal', async () => {
  await mount();
  expect(textOf(renderer!.root)).toContain('$79.315,50');
  expect(textOf(renderer!.root)).toContain('-$758,71');
  expect(textOf(renderer!.root)).toContain('$1.589,90 Milyar');
  expect(textOf(renderer!.root)).not.toContain('₺');
  const chart = renderer!.root.findAllByType('section').find(node => node.props.onMouseMove)!;
  await act(async () => chart.props.onMouseMove({ activePayload: [{ payload: { close: 78000, date: 'Test' } }] }));
  expect(textOf(renderer!.root)).toContain('$78.000,00');
  expect(textOf(renderer!.root)).toContain('-$1.300,00');

  await act(async () => button('Al').props.onClick());
  const modal = renderer!.root.findByType(TradeModal);
  expect(modal.props.marketType).toBe('CRYPTO');
  expect(fetchMock).toHaveBeenCalledWith('/api/fx');
  expect(textOf(modal)).toContain('1 USD = ₺32,00');
  expect(textOf(modal)).toContain('$79.315,50'); // execution uses latest quote, not hovered candle
  await act(async () => button('Tutar (TL)').props.onClick());
  await act(async () => modal.findByProps({ placeholder: 'Tutar girin (TL)' }).props.onChange({ target: { value: '1000' } }));
  const submit = modal.findAllByType('button').find(node => textOf(node).endsWith(' Adet Al'))!;
  expect(submit.props.disabled).toBe(false);
  await act(async () => submit.props.onClick());
  expect(orderBody).toMatchObject({ symbol: 'BTC-USD', marketType: 'CRYPTO', type: 'BUY' });
  expect(tradeSchema.safeParse(orderBody).success).toBe(true);
  expect(orderBody.quantity).toBeGreaterThan(0);
  expect(orderBody.quantity).toBeLessThan(0.001);
  expect(orderBody.quantity * 79315.5 * 32 * 1.002).toBeLessThanOrEqual(1000);
  expect((orderBody.quantity + 1e-8) * 79315.5 * 32 * 1.002).toBeGreaterThan(1000);
});

it('blocks BTC order submission when the FX request fails', async () => {
  fxUnavailable = true;
  await mount();
  await act(async () => button('Al').props.onClick());
  const modal = renderer!.root.findByType(TradeModal);
  await act(async () => modal.findByProps({ placeholder: 'Adet girin' }).props.onChange({ target: { value: '0.001' } }));
  const submit = modal.findAllByType('button').find(node => textOf(node).endsWith(' Adet Al'))!;
  expect(submit.props.disabled).toBe(true);
  expect(textOf(modal)).toContain('Kur alınamadı');
  expect(orderBody).toBeUndefined();
});

it('keeps BIST in TRY without requesting FX, and excludes index buy/sell buttons', async () => {
  await mount('THYAO.IS');
  expect(textOf(renderer!.root)).toContain('₺315,50');
  await act(async () => button('Al').props.onClick());
  expect(renderer!.root.findByType(TradeModal).props.marketType).toBe('BIST');
  expect(fetchMock).not.toHaveBeenCalledWith('/api/fx');
  await act(async () => renderer!.unmount());
  await mount('XU100.IS');
  expect(button('Al')).toBeUndefined();
  expect(button('Sat')).toBeUndefined();
  expect(textOf(renderer!.root)).toContain('Puan');
});
