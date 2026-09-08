import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/fx', () => ({ getUsdTryRate: vi.fn() }));
vi.mock('../lib/db', () => ({ prisma: {} }));
vi.mock('../lib/market-quotes', () => ({ getMarketQuotes: vi.fn(), normalizeMarketSymbol: (s: string) => s }));
vi.mock('../lib/trading', async importOriginal => {
  const original = await importOriginal<typeof import('../lib/trading')>();
  return { ...original, executeTrade: vi.fn() };
});
import { getServerSession } from 'next-auth';
import { getMarketQuotes } from '../lib/market-quotes';
import { getUsdTryRate } from '../lib/fx';
import { CurrencyError } from '../lib/currency';
import { executeTrade } from '../lib/trading';
import { POST } from '../app/api/trade/route';
const order = { symbol: 'THYAO.IS', type: 'BUY', quantity: 10, price: 1 };
const request = (body: unknown) => new NextRequest('http://localhost/api/trade', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'owner' } });
  vi.mocked(getMarketQuotes).mockResolvedValue([{ symbol: 'THYAO.IS', price: 100, currency: 'TRY' } as any]);
  vi.mocked(executeTrade).mockResolvedValue({ success: true, message: 'ok', warnings: [], price: 100, priceTry: 100, fxRate: 1 });
});
it('executes using the trusted quote instead of a forged client price', async () => {
  expect((await POST(request(order))).status).toBe(200);
  expect(executeTrade).toHaveBeenCalledWith({}, 'owner', expect.objectContaining({ quantity: 10 }), 100, undefined);
});
it('rejects invalid input before querying providers or the ledger', async () => {
  expect((await POST(request({ ...order, quantity: -5 }))).status).toBe(400);
  expect(getMarketQuotes).not.toHaveBeenCalled();
  expect(executeTrade).not.toHaveBeenCalled();
});
it('requires an authenticated user id', async () => {
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await POST(request(order))).status).toBe(401);
  expect(executeTrade).not.toHaveBeenCalled();
});
it('does not trade when quotes are unavailable', async () => {
  vi.mocked(getMarketQuotes).mockResolvedValue([{ price: 0, error: true } as any]);
  expect((await POST(request(order))).status).toBe(503);
  expect(executeTrade).not.toHaveBeenCalled();
});
it('rejects malformed JSON without a server error', async () => {
  const req = new NextRequest('http://localhost/api/trade', { method: 'POST', body: '{' });
  expect((await POST(req)).status).toBe(400);
});
it('obtains the FX rate on the server instead of accepting a client-supplied rate', async () => {
  const fx = { rate: 32, asOf: new Date() };
  vi.mocked(getUsdTryRate).mockResolvedValue(fx);
  vi.mocked(getMarketQuotes).mockResolvedValue([{ symbol: 'BTC-USD', price: 60000, currency: 'USD' } as any]);
  const response = await POST(request({ ...order, symbol: 'BTC-USD', marketType: 'CRYPTO', quantity: 0.01, fxRate: 1 }));
  expect(response.status).toBe(200);
  expect(executeTrade).toHaveBeenCalledWith({}, 'owner', expect.objectContaining({ quantity: 0.01 }), 60000, fx);
});
it('prevents any ledger writes when the exchange rate is unavailable', async () => {
  vi.mocked(getUsdTryRate).mockRejectedValue(new CurrencyError('Kur alınamadı'));
  vi.mocked(getMarketQuotes).mockResolvedValue([{ symbol: 'BTC-USD', price: 60000, currency: 'USD' } as any]);
  expect((await POST(request({ ...order, symbol: 'BTC-USD', marketType: 'CRYPTO', quantity: 0.01 }))).status).toBe(503);
  expect(executeTrade).not.toHaveBeenCalled();
});
it('rejects a quote in the wrong currency before requesting execution', async () => {
  vi.mocked(getMarketQuotes).mockResolvedValue([{ symbol: 'BTC-USD', price: 60000, currency: 'TRY' } as any]);
  expect((await POST(request({ ...order, symbol: 'BTC-USD', marketType: 'CRYPTO', quantity: 0.01 }))).status).toBe(503);
  expect(executeTrade).not.toHaveBeenCalled();
});
