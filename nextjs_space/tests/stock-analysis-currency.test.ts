import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/yahoo-finance', () => ({ cachedChart: vi.fn(), cachedQuoteBatch: vi.fn() }));
vi.mock('../lib/midas-api', () => ({ getMidasStockMap: vi.fn() }));
vi.mock('../lib/ai-provider', () => ({ getAIConfig: vi.fn(), requestAICompletion: vi.fn(), aiErrorResponse: vi.fn() }));
import { getServerSession } from 'next-auth';
import { cachedChart } from '../lib/yahoo-finance';
import { requestAICompletion } from '../lib/ai-provider';
import { POST } from '../app/api/stock-analysis/route';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'fixture-user' } });
  vi.mocked(cachedChart).mockResolvedValue({ quotes: [] } as any);
  vi.mocked(requestAICompletion).mockResolvedValue(new Response('data: [DONE]\n\n'));
});

it.each([
  ['BTC-USD', 'BTC-USD', 'USD'],
  ['THYAO', 'THYAO.IS', 'TRY'],
  ['XU100.IS', 'XU100.IS', 'puan'],
])('keeps %s historical symbols and analysis price units consistent', async (symbol, expectedSymbol, unit) => {
  const response = await POST(new NextRequest('http://localhost/api/stock-analysis', {
    method: 'POST', body: JSON.stringify({ symbol, price: 79315.5, change: -758.71, changePercent: -0.97,
      marketCap: 1.5e12, supportResistance: { supports: [{ price: 75000 }], resistances: [{ price: 80000 }] },
    }),
  }));
  expect(response.status).toBe(200);
  await response.text();
  expect(cachedChart).toHaveBeenCalledWith(expectedSymbol, expect.any(Object));
  const content = vi.mocked(requestAICompletion).mock.calls[0][0].messages.map(message => message.content).join('\n');
  expect(content).toContain(`Fiyat: 79315.5 ${unit}`);
  expect(content).toContain(`Destekler: 75000.00 ${unit}`);
  expect(content).toContain(`Dirençler: 80000.00 ${unit}`);
  if (unit === 'USD') expect(content).not.toContain(' TL');
});
