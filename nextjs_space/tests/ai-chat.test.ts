import { NextRequest } from 'next/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('../lib/auth', () => ({ authOptions: {} }));
vi.mock('../lib/db', () => ({ prisma: {} }));
vi.mock('../lib/news-feed', () => ({ getAllNews: vi.fn() }));
vi.mock('../lib/midas-api', () => ({ getMidasStock: vi.fn(), getMidasStockMap: vi.fn() }));
vi.mock('../lib/yahoo-finance', () => ({ cachedQuote: vi.fn(), cachedChart: vi.fn() }));
vi.mock('../lib/ai-provider', async (original) => ({
  ...await original<typeof import('../lib/ai-provider')>(),
  getAIConfig: vi.fn(), requestAICompletion: vi.fn(),
}));
import { getServerSession } from 'next-auth';
import { AIServiceError, getAIConfig, requestAICompletion } from '../lib/ai-provider';
import { getAllNews } from '../lib/news-feed';
import { cachedQuote } from '../lib/yahoo-finance';
import { readAIStream } from '../lib/ai-stream-client';
import { CHAT_DATA_TIMEOUT_MS } from '../lib/ai-data-context';
import { evidenceHeader, type EvidenceSource } from '../lib/evidence';
import { getMidasStockMap } from '../lib/midas-api';
import { POST } from '../app/api/ai-chat/route';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'test-user' } });
  vi.mocked(getAllNews).mockResolvedValue([]);
  vi.mocked(getMidasStockMap).mockResolvedValue(new Map());
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
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
  expect(await readAIStream(response, vi.fn())).toBe('İyi günler');
});
it('forwards a quota error to the existing client instead of a generic 500', async () => {
  vi.mocked(requestAICompletion).mockRejectedValue(new AIServiceError('Kota doldu.', 429, 60));
  const response = await POST(request([{ role: 'user', content: 'Merhaba' }]));
  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ error: 'Kota doldu.' });
});

it('continues after a long answer with more than 100 earlier turns', async () => {
  vi.mocked(requestAICompletion).mockResolvedValue(new Response('data: [DONE]\n\n'));
  const messages = Array.from({ length: 102 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'eski' }));
  messages.push({ role: 'assistant', content: 'a'.repeat(9000) }, { role: 'user', content: 'Merhaba' });
  expect((await POST(request(messages))).status).toBe(200);
  const sent = vi.mocked(requestAICompletion).mock.calls[0][0].messages;
  expect(sent).toHaveLength(7); // System prompt plus six recent turns.
  expect(sent.at(-2)?.content).toHaveLength(6000);
  expect(sent.at(-1)).toEqual({ role: 'user', content: 'Merhaba' });
});

const answer = () => new Response('data: {"choices":[{"delta":{"content":"Verilere göre yanıt"}}]}\n\ndata: [DONE]\n\n');
const headline = (index = 0) => ({
  title: `${index} Türkçe piyasa gelişmeleri, şirketlerin büyüme ve dönüşüm çalışmaları`.repeat(2),
  summary: 'Kaynakta bildirilen gelişme', source: 'Test gazetesi',
  url: `https://example.com/haber/${index}`, date: '2026-09-16T08:00:00Z',
  dateVerified: true, category: 'bist' as const,
});

it.each(['Borsa durumu', 'Borsa neden düştü', 'Bugün borsa nasıldı?', 'Son haberler neler?'])(
  'answers "%s" with one AI call and sources in the body, without an HTTP self-call', async question => {
    vi.mocked(getAllNews).mockResolvedValue(Array.from({ length: 10 }, (_, i) => headline(i)));
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    vi.mocked(requestAICompletion).mockResolvedValue(answer());
    const response = await POST(request([{ role: 'user', content: question }]));
    expect(response.status).toBe(200);
    expect(fetcher).not.toHaveBeenCalled();
    expect(requestAICompletion).toHaveBeenCalledTimes(1);
    expect(response.headers.has('X-BorsaBi-Sources')).toBe(false);
    let headers = ''; response.headers.forEach((v, k) => { headers += `${k}: ${v}\r\n`; });
    expect(new TextEncoder().encode(headers).length).toBeLessThan(1024);
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');
    const metadata = vi.fn();
    expect(await readAIStream(response, vi.fn(), metadata)).toBe('Verilere göre yanıt');
    const sources = metadata.mock.calls[0][0] as EvidenceSource[];
    expect(sources).toHaveLength(10);
    // This same metadata exceeded a 4K proxy header budget in the old transport.
    expect(evidenceHeader(sources).length).toBeGreaterThan(4096);
    expect(vi.mocked(requestAICompletion).mock.calls[0][0].messages[0].content).toContain('Kaynakta bildirilen gelişme');
  },
);

it('continues with available data when a news service stalls, without late source leakage', async () => {
  vi.useFakeTimers();
  let finishNews!: (value: ReturnType<typeof headline>[]) => void;
  vi.mocked(getAllNews).mockReturnValue(new Promise(resolve => { finishNews = resolve; }));
  vi.mocked(cachedQuote).mockResolvedValue({ regularMarketPrice: 100, regularMarketChangePercent: -1, regularMarketTime: new Date('2026-09-16T08:00:00Z') } as any);
  vi.mocked(requestAICompletion).mockResolvedValue(answer());
  const pending = POST(request([{ role: 'user', content: 'Borsa durumu' }]));
  await vi.advanceTimersByTimeAsync(CHAT_DATA_TIMEOUT_MS);
  const response = await pending;
  expect(response.status).toBe(200);
  const system = vi.mocked(requestAICompletion).mock.calls[0][0].messages[0].content;
  expect(system).toContain('BIST 100: 100');
  expect(system).toContain('Veri alınamadı veya zamanında tamamlanmadı: Haberler');
  finishNews([headline()]);
  const metadata = vi.fn();
  await readAIStream(response, vi.fn(), metadata);
  expect(metadata.mock.calls[0][0]).toHaveLength(5);
  expect(metadata.mock.calls[0][0].some((s: EvidenceSource) => s.url.includes('example.com'))).toBe(false);
});

it('does not fabricate a publication time or lose a successful chat when the feed is empty', async () => {
  vi.mocked(getAllNews).mockResolvedValue([{ ...headline(), dateVerified: false }]);
  vi.mocked(requestAICompletion).mockImplementation(async () => answer());
  const response = await POST(request([{ role: 'user', content: 'Son haberler' }]));
  const metadata = vi.fn(); await readAIStream(response, vi.fn(), metadata);
  expect(metadata.mock.calls[0][0][0].asOf).toBeNull();
  vi.mocked(getAllNews).mockResolvedValue([]);
  const empty = await POST(request([{ role: 'user', content: 'Borsa durumu' }]));
  expect(empty.status).toBe(200);
  expect(vi.mocked(requestAICompletion).mock.calls[1][0].messages[0].content).toContain('Veri alınamadı');
});

it('keeps the working screening suggestion independent of news services', async () => {
  vi.mocked(requestAICompletion).mockResolvedValue(answer());
  const response = await POST(request([{ role: 'user', content: 'Sektörel bazda en iyi performans gösteren hisseler' }]));
  expect(response.status).toBe(200);
  expect(getAllNews).not.toHaveBeenCalled();
  expect(requestAICompletion).toHaveBeenCalledTimes(1);
});

it('does not start a paid completion after the user disconnects during data gathering', async () => {
  const controller = new AbortController();
  vi.mocked(getAllNews).mockReturnValue(new Promise(() => {}));
  const req = new NextRequest('http://localhost/api/ai-chat', {
    method: 'POST', signal: controller.signal,
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Borsa durumu' }] }),
  });
  const pending = POST(req);
  await vi.waitFor(() => expect(getAllNews).toHaveBeenCalled());
  controller.abort();
  await pending;
  expect(requestAICompletion).not.toHaveBeenCalled();
});
