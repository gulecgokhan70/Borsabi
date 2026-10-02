import { createElement, type ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// Keep React state, effects, the detail page and TradeModal real. Only replace
// navigation, chart drawing and animation, which need a browser layout engine.
vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: 'authenticated', data: { user: { id: 'test-user' } } }) }));
vi.mock('react-dom', async original => ({ ...await original<any>(), createPortal: (children: ReactNode) => children }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => createElement('a', props, children) }));
vi.mock('framer-motion', () => ({
  motion: { div: 'div' }, AnimatePresence: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('recharts', () => {
  const container = ({ children, onMouseMove, onMouseDown, onMouseUp }: any) => createElement('section', { onMouseMove, onMouseDown, onMouseUp }, children);
  return {
    ResponsiveContainer: container, ComposedChart: container,
    Bar: container, Line: () => null, Area: () => null, XAxis: () => null,
    YAxis: () => null, Tooltip: () => null, CartesianGrid: () => null,
    ReferenceLine: () => null, Cell: () => null,
  };
});
vi.mock('../components/chart-surface', () => ({ ChartSurface: ({ children, controls, full, onFullChange, footer }: any) => createElement('div', null, children, controls, createElement('button', { 'aria-label': full ? 'Grafiği kapat' : 'Grafiği tam ekran aç', onClick: () => onFullChange(!full) }, full ? 'Kapat' : 'Tam ekran'), full ? footer : null) }));
vi.mock('../components/chart-drawing-tools', () => ({ ChartDrawingToolbar: () => null, ChartDrawingOverlay: () => null }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import StockDetailClient from '../app/stock/[symbol]/stock-detail-client';
import { Tooltip, Line, Area } from 'recharts';
import { ChartSurface } from '../components/chart-surface';
import { StockAnalysisSheet } from '../components/stock-analysis-sheet';
import { TradeModal } from '../components/trade-modal';
import { tradeSchema } from '../lib/trading';

let renderer: ReactTestRenderer | undefined;
let fxUnavailable = false;
let heldQuantity = 0;
let orderBody: any;
let loseReply = false;
const sessionValues = new Map<string, string>();
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
  ohlc: [{ time: 100, date: new Date().toISOString(), open: 79000, high: 80000, low: 78000, close: 79300, volume: 10, macd: 1, macdSignal: 0.5, macdHistogram: 0.5, rsi: 48, sma20: 79000, sma50: 78000, sma200: 77000 }],
});

const textOf = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => textOf(child)).join('');
const button = (label: string) => renderer!.root.findAllByType('button').find(node => textOf(node).trim() === label)!;
const mount = async (symbol = 'BTC-USD') => {
  await act(async () => { renderer = create(createElement(StockDetailClient, { symbol })); });
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
  fxUnavailable = false; heldQuantity = 0; orderBody = undefined; loseReply = false; sessionValues.clear();
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => sessionValues.get(key) ?? null, setItem: (key: string, value: string) => sessionValues.set(key, value), removeItem: (key: string) => sessionValues.delete(key) });
  fetchMock.mockReset().mockImplementation(async (input: string, options?: RequestInit) => {
    if (input.endsWith('/activity')) return Response.json({ open: [], closed: [], trades: [], moreClosed: false, moreTrades: false, valuationUnavailable: false });
    if (input.startsWith('/api/stock/')) return Response.json(fixture(decodeURIComponent(input.split('/')[3].split('?')[0])));
    if (input === '/api/watchlist') return Response.json(options?.method === 'POST' ? { added: true } : { data: [] });
    if (input.startsWith('/api/news')) return Response.json({ news: [] });
    if (input === '/api/portfolio') return Response.json({ accountId: 'test-user', balance: 100000, commissionRate: 0.002, positions: [{ symbol: "THYAO.IS", quantity: heldQuantity }] });
    if (input === '/api/fx') return fxUnavailable
      ? Response.json({ error: 'Kur alınamadı' }, { status: 503 })
      : Response.json({ rate: 32, asOf: new Date().toISOString() });
    if (input === '/api/trade') {
      orderBody = JSON.parse(String(options?.body));
      if (loseReply) throw new TypeError('Connection dropped after server accepted order');
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
  expect(textOf(renderer!.root.findByProps({ 'aria-label': 'Hisse fiyatı' }))).toContain('$79.300,00');
  expect(textOf(renderer!.root)).toContain('Son fiyat $79.315,50');
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
  expect(orderBody.maxSpendTry).toBe(1000);
  expect(orderBody.requestId).toBeTypeOf('string');
  expect(tradeSchema.safeParse(orderBody).success).toBe(true);
  expect(orderBody.quantity).toBeGreaterThan(0);
  expect(orderBody.quantity).toBeLessThan(0.001);
  expect(orderBody.quantity * 79315.5 * 32 * 1.002).toBeLessThanOrEqual(1000);
  expect((orderBody.quantity + 1e-8) * 79315.5 * 32 * 1.002).toBeGreaterThan(1000);
});

it('keeps the exact pending request across modal remounts and guards double taps', async () => {
  await mount();
  await act(async () => button('Al').props.onClick());
  const modal = renderer!.root.findByType(TradeModal);
  await act(async () => modal.findByProps({ placeholder: 'Adet girin' }).props.onChange({ target: { value: '0.0001' } }));
  const submit = modal.findAllByType('button').find(node => textOf(node).endsWith(' Adet Al'))!;
  loseReply = true;
  await act(async () => { await Promise.all([submit.props.onClick(), submit.props.onClick()]); });
  const original = { ...orderBody };
  expect(fetchMock.mock.calls.filter(([url]) => url === '/api/trade')).toHaveLength(1);
  expect(sessionValues.size).toBe(1);
  await act(async () => renderer!.unmount());
  await mount(); await act(async () => button('Al').props.onClick());
  loseReply = false;
  await act(async () => button('Son emrin sonucunu kontrol et').props.onClick());
  expect(orderBody).toEqual(original);
  expect(sessionValues.size).toBe(0);
});

it('blocks BTC order submission when the FX request fails', async () => {
  fxUnavailable = true;
  await mount();
  await act(async () => button('Al').props.onClick());
  const modal = renderer!.root.findByType(TradeModal);
  await act(async () => modal.findByProps({ placeholder: 'Adet girin' }).props.onChange({ target: { value: '0.001' } }));
  const submit = modal.findAllByType('button').find(node => textOf(node) === 'Sanal alım')!;
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


it('keeps invalid quantity feedback visible and suppresses negative accounting totals', async () => {
  await mount('THYAO.IS');
  await act(async () => button('Al').props.onClick());
  const modal = renderer!.root.findByType(TradeModal);
  await act(async () => modal.findByProps({ placeholder: 'Adet girin' }).props.onChange({ target: { value: '-1' } }));
  expect(button('Sanal alım').props.disabled).toBe(true);
  expect(textOf(modal)).toContain('Sıfırdan büyük');
  expect(textOf(modal)).not.toContain('Bakiyeden düşülecek');
  expect(textOf(modal)).not.toContain('-₺');
  expect(orderBody).toBeUndefined();
});
it('blocks an oversell in the real form and recovers when the quantity is corrected', async () => {
  heldQuantity = 1;
  await mount('THYAO.IS');
  await act(async () => button('Sat').props.onClick());
  const modal = renderer!.root.findByType(TradeModal);
  const input = modal.findByProps({ placeholder: 'Adet girin' });
  await act(async () => input.props.onChange({ target: { value: '2' } }));
  expect(button('Sanal satış').props.disabled).toBe(true);
  expect(textOf(modal)).toContain('En fazla 1 adet satabilirsiniz');
  await act(async () => button('Sanal satış').props.onClick());
  expect(orderBody).toBeUndefined();
  await act(async () => input.props.onChange({ target: { value: '1' } }));
  expect(button('1 Adet Sat').props.disabled).toBe(false);
  expect(textOf(modal)).not.toContain('En fazla 1 adet satabilirsiniz');
});
it('shows post-trade cash including the profile commission for both directions', async () => {
  heldQuantity = 1;
  await mount('THYAO.IS');
  await act(async () => button('Al').props.onClick());
  let modal = renderer!.root.findByType(TradeModal);
  let quantity = modal.findByProps({ placeholder: 'Adet girin' });
  await act(async () => quantity.props.onChange({ target: { value: '1' } }));
  expect(textOf(modal)).toContain('İşlem sonrası tahmini nakit bakiye₺99.683,87');
  await act(async () => modal.props.onClose());
  await act(async () => button('Sat').props.onClick());
  modal = renderer!.root.findByType(TradeModal);
  quantity = modal.findByProps({ placeholder: 'Adet girin' });
  await act(async () => quantity.props.onChange({ target: { value: '1' } }));
  expect(textOf(modal)).toContain('İşlem sonrası tahmini nakit bakiye₺100.314,87');
});
it('shows a fee-inclusive scenario only for valid buys and sends the original decision note', async () => {
  await mount('THYAO.IS');
  await act(async () => button('Al').props.onClick());
  const modal = renderer!.root.findByType(TradeModal);
  const quantity = modal.findByProps({ placeholder: 'Adet girin' });
  await act(async () => quantity.props.onChange({ target: { value: '-1' } }));
  expect(textOf(modal)).not.toContain('İşlem öncesi senaryoyu incele');
  await act(async () => quantity.props.onChange({ target: { value: '1' } }));
  expect(textOf(modal)).toContain('İşlem öncesi senaryoyu incele');
  const select = modal.findByType('select');
  await act(async () => select.props.onChange({ target: { value: '0' } }));
  expect(textOf(modal)).toContain('Senaryo fiyatında tamamını satarsan net sonuç-₺1,26');
  await act(async () => modal.findByProps({ id: 'trade-decision' }).props.onChange({ target: { value: 'Destek seviyesini izleyeceğim.' } }));
  const submit = modal.findAllByType('button').find(node => textOf(node).endsWith(' Adet Al'))!;
  await act(async () => submit.props.onClick());
  expect(orderBody.note).toBe('Destek seviyesini izleyeceğim.');
});


it('uses one-day data for 1G and submits a watchlist toggle once for rapid taps', async () => {
  await mount('THYAO.IS');
  await act(async () => button('1A').props.onClick());
  await act(async () => button('1G').props.onClick());
  expect(fetchMock).toHaveBeenCalledWith('/api/stock/THYAO.IS?period=1d&interval=5m');
  const save = renderer!.root.findByProps({ 'aria-label': 'İzleme listesine ekle' });
  await act(async () => { await Promise.all([save.props.onClick(), save.props.onClick()]); });
  expect(fetchMock.mock.calls.filter(([url, options]) => url === '/api/watchlist' && options?.method === 'POST')).toHaveLength(1);
  expect(renderer!.root.findByProps({ 'aria-label': 'İzleme listesinden çıkar' }).props['aria-pressed']).toBe(true);
});

it('disables trades when the detail response has no usable price', async () => {
  const fallback = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) => url.startsWith('/api/stock/') && !url.endsWith('/activity')
    ? Response.json({ ...fixture('THYAO.IS'), price: 0 })
    : fallback(url, options));
  await mount('THYAO.IS');
  expect(button('Al').props.disabled).toBe(true);
  expect(button('Sat').props.disabled).toBe(true);
  expect(textOf(renderer!.root)).toContain('Fiyat alınamadı');
});


it('dismisses price and volume information after 3 seconds, resets on interaction and reopens', async () => {
  await mount('BTC-USD');
  const charts = () => renderer!.root.findAllByType('section').filter(node => node.props.onMouseMove);
  const tips = () => renderer!.root.findAllByType(Tooltip);
  const move = () => charts()[0].props.onMouseMove({ activePayload: [{ payload: { close: 78000, date: 'Test' } }] });
  await act(async () => move());
  expect(tips()[0].props.active).toBeUndefined();
  expect(textOf(renderer!.root)).toContain('$78.000,00');
  await act(async () => { vi.advanceTimersByTime(2000); });
  await act(async () => move());
  await act(async () => { vi.advanceTimersByTime(2000); });
  expect(tips()[0].props.active).toBeUndefined();
  await act(async () => { vi.advanceTimersByTime(1000); });
  expect(tips()[0].props.active).toBe(false);
  expect(textOf(renderer!.root.findByProps({ 'aria-label': 'Hisse fiyatı' }))).toContain('$79.300,00');
  await act(async () => move());
  expect(tips()[0].props.active).toBeUndefined();
  await act(async () => renderer!.root.findByProps({ 'aria-label': 'Grafiği tam ekran aç' }).props.onClick());
  await act(async () => charts()[1].props.onMouseMove());
  expect(tips()[0].props.active).toBe(false);
  expect(tips()[1].props.active).toBeUndefined();
  await act(async () => { vi.advanceTimersByTime(3000); });
  expect(tips().every(tip => tip.props.active === false)).toBe(true);
  await act(async () => charts()[3].props.onMouseDown());
  expect(tips()[3].props.active).toBeUndefined();
  await act(async () => { vi.advanceTimersByTime(3000); });
  expect(tips()[3].props.active).toBe(false);
  await act(async () => charts()[3].props.onMouseUp());
  expect(tips()[3].props.active).toBeUndefined();
  await act(async () => button('1A').props.onClick());
  expect(tips().every(tip => tip.props.active === false)).toBe(true);
});

it('moves technical controls into full screen and distinguishes period from candle interval', async () => {
  await mount();
  expect(button('EMA')).toBeUndefined();
  expect(renderer!.root.findAllByType(Line).some(line => line.props.dataKey === 'rsi')).toBe(false);
  await act(async () => renderer!.root.findByProps({ 'aria-label': 'Grafiği tam ekran aç' }).props.onClick());
  expect(button('1G').props['aria-pressed']).toBe(true);
  expect(textOf(renderer!.root)).toContain('RSI(14)');
  expect(textOf(renderer!.root)).toContain('MACD(12,26,9)');
  const interval = renderer!.root.findByProps({ 'aria-label': 'Mum aralığı ve dönem' });
  await act(async () => interval.props.onChange({ target: { value: '5m' } }));
  expect(button('1G').props['aria-pressed']).toBe(false);
  expect(interval.props.value).toBe('5m');
  expect(textOf(renderer!.root)).toContain('EMA200: en az 200 mum geçmişi gerekli');
  await act(async () => button('SMA').props.onClick());
  expect(renderer!.root.findAllByType(Line).map(line => line.props.dataKey)).toContain('sma200');
  expect(renderer!.root.findAllByType(Line).map(line => line.props.dataKey)).not.toContain('ema200');
  await act(async () => button('Bollinger').props.onClick());
  expect(renderer!.root.findAllByType(Line).map(line => line.props.dataKey)).toEqual(expect.arrayContaining(['sma200', 'bbUpper', 'rsi', 'macd']));
  await act(async () => button('5Y').props.onClick());
  expect(fetchMock).toHaveBeenCalledWith('/api/stock/BTC-USD?period=5y&interval=1wk');
  await act(async () => button('Al').props.onClick());
  expect(renderer!.root.findByType(ChartSurface).props.full).toBe(false);
  expect(renderer!.root.findByType(TradeModal).props.isOpen).toBe(true);
  expect(renderer!.root.findByType(TradeModal).props.price).toBe(79315.5);
});

it('generates analysis only on request, guards duplicate taps and exposes stream failures', async () => {
  const fallback = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) => url === '/api/stock-analysis'
    ? new Response('data: {"status":"completed","result":{"genel_gorunum":"Test analizi","trend":"AŞAĞI"}}')
    : fallback(url, options));
  await mount();
  await act(async () => { vi.advanceTimersByTime(1000); });
  expect(fetchMock.mock.calls.some(([url]) => url === '/api/stock-analysis')).toBe(false);
  const panel = () => renderer!.root.findByType(StockAnalysisSheet);
  await act(async () => { await Promise.all([panel().props.onGenerate(), panel().props.onGenerate()]); });
  expect(fetchMock.mock.calls.filter(([url]) => url === '/api/stock-analysis')).toHaveLength(1);
  expect(panel().props.analysis).toMatchObject({ genel_gorunum: 'Test analizi' });
  expect(panel().props.generatedAt).toBeTruthy();
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) => url === '/api/stock-analysis'
    ? new Response('data: {"status":"error","message":"private provider error"}\n\n')
    : fallback(url, options));
  await act(async () => panel().props.onGenerate());
  expect(panel().props.error).toContain('Analiz tamamlanamadı');
  expect(panel().props.error).not.toContain('private');
});

it('uses previous close for the daily colour and switches both percentage and colour with the period', async () => {
  const fallback = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) => url.startsWith('/api/stock/') && !url.endsWith('/activity')
    ? Response.json({ ...fixture('AKCNS.IS'), price: 211.7, prevClose: 209, chartPreviousClose: 209, change: 2.7, changePercent: 1.29,
      ohlc: [230, 211.7].map(close => ({ ...fixture('AKCNS.IS').ohlc[0], open: close, high: close, low: close, close })) })
    : fallback(url, options));
  await mount('AKCNS.IS');
  const headline = () => renderer!.root.findByProps({ 'aria-label': 'Hisse fiyatı' });
  expect(textOf(headline())).toContain('+%1,29');
  expect(renderer!.root.findByType(Area as any).props.stroke).toBe('#22C55E');
  await act(async () => button('1H').props.onClick());
  expect(textOf(headline())).toContain('1 haftalık değişim');
  expect(textOf(headline())).toContain('-%7,96');
  expect(renderer!.root.findByType(Area as any).props.stroke).toBe('#EF4444');
  // The order form still receives the latest quote independently of the chart range.
  await act(async () => button('Al').props.onClick());
  expect(renderer!.root.findByType(TradeModal).props.price).toBe(211.7);
});
