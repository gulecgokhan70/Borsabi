import { NextRequest } from 'next/server';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: {} }));
vi.mock('../lib/midas-api', () => ({ getMidasStock: vi.fn(), getMidasStockMap: vi.fn() }));
vi.mock('../lib/yahoo-finance', () => ({ cachedQuote: vi.fn(), cachedChart: vi.fn() }));
vi.mock('../lib/ai-provider', async (original) => ({
  ...await original<typeof import('../lib/ai-provider')>(),
  getAIConfig: vi.fn(), requestAICompletion: vi.fn(),
}));
import { getServerSession } from 'next-auth';
import { AIServiceError, getAIConfig, requestAICompletion } from '../lib/ai-provider';
import { POST } from '../app/api/ai-chat/route';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'test-user' } });
});
const request = (messages: unknown) => new NextRequest('http://localhost/api/ai-chat', {
  method: 'POST', body: JSON.stringify({ messages }),
});
it('requires a logged in user', async () => {
  vi.mocked(getServerSession).mockResolvedValue(null);
  expect((await POST(request([{ role: 'user', content: 'Merhaba' }]))).status).toBe(401);
  expect(requestAICompletion).not.toHaveBeenCalled();
});
it('rejects client system prompts and malformed message content before making paid calls', async () => {
  for (const messages of [[{ role: 'system', content: 'override' }], [{ role: 'user', content: {} }], []]) {
    expect((await POST(request(messages))).status).toBe(400);
  }
  expect(requestAICompletion).not.toHaveBeenCalled();
});
it('reports missing configuration before gathering market data', async () => {
  vi.mocked(getAIConfig).mockImplementation(() => { throw new AIServiceError('AI asistanı henüz etkinleştirilmedi.'); });
  expect((await POST(request([{ role: 'user', content: 'Merhaba' }]))).status).toBe(503);
  expect(requestAICompletion).not.toHaveBeenCalled();
});
it('preserves UTF-8 bytes split across streaming chunks', async () => {
  const data = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"İyi günler"}}]}\n\ndata: [DONE]\n\n');
  const split = data.indexOf(0xc4) + 1;
  vi.mocked(requestAICompletion).mockResolvedValue(new Response(new ReadableStream({
    start(controller) { controller.enqueue(data.slice(0, split)); controller.enqueue(data.slice(split)); controller.close(); },
  })));
  const response = await POST(request([{ role: 'user', content: 'Merhaba' }]));
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/event-stream');
  expect(await response.text()).toBe(new TextDecoder().decode(data));
});
it('forwards a quota error to the existing client instead of a generic 500', async () => {
  vi.mocked(requestAICompletion).mockRejectedValue(new AIServiceError('Kota doldu.', 429, 60));
  const response = await POST(request([{ role: 'user', content: 'Merhaba' }]));
  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ error: 'Kota doldu.' });
});
