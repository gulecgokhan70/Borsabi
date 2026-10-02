import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { useAIConversation } from '../hooks/use-ai-conversation';
import { CHAT_MESSAGE_LIMIT } from '../lib/chat-context';
let state: ReturnType<typeof useAIConversation>, renderer: ReactTestRenderer;
function Harness() { state = useAIConversation(); return null; }
afterEach(async () => { await act(async () => renderer?.unmount()); vi.unstubAllGlobals(); vi.useRealTimers(); });
const part = (s: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: s } }] })}\n\n`;
const answer = (s: string) => new Response(part(s) + 'data: [DONE]\n\n');
it('sends a typed Turkish question through the same path as a suggestion, with prior successful context', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(answer('İlk yanıt')).mockResolvedValueOnce(answer('Devam yanıtı'));
  vi.stubGlobal('fetch', fetcher);
  await act(async () => { renderer = create(createElement(Harness)); });
  await act(async () => { state.setInput('Borsa neden düştü?'); });
  await act(async () => { await state.sendMessage(); });
  expect(state.messages.at(-1)?.content).toBe('İlk yanıt');
  await act(async () => { await state.sendMessage('Peki neden?'); });
  const sent = JSON.parse(fetcher.mock.calls[1][1].body).messages;
  expect(sent).toEqual([{ role: 'user', content: 'Borsa neden düştü?' }, { role: 'assistant', content: 'İlk yanıt' }, { role: 'user', content: 'Peki neden?' }]);
});
it('preserves partial text and sources on stream failure; retry replaces just that exchange', async () => {
  const source = { label: 'Kaynak', url: 'https://example.com/news', asOf: null, status: 'Bilinmiyor' };
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(`data: ${JSON.stringify({ type: 'sources', sources: [source] })}\n\n${part('Yarım açıklama')}`))
    .mockResolvedValueOnce(answer('Tam açıklama'));
  vi.stubGlobal('fetch', fetcher);
  await act(async () => { renderer = create(createElement(Harness)); });
  await act(async () => { await state.sendMessage('Borsa durumu'); });
  expect(state.messages.at(-1)).toMatchObject({ content: 'Yarım açıklama', sources: [source], retry: 'Borsa durumu' });
  expect(state.messages.at(-1)?.error).toContain('tamamlanamadı');
  await act(async () => { state.setInput('Sonraki sorum'); });
  await act(async () => { await state.sendMessage('Borsa durumu', 1); });
  expect(state.messages).toHaveLength(2);
  expect(state.messages.at(-1)?.content).toBe('Tam açıklama');
  expect(state.input).toBe('Sonraki sorum');
  expect(JSON.parse(fetcher.mock.calls[1][1].body).messages).toEqual([{ role: 'user', content: 'Borsa durumu' }]);
});
it('keeps a failed exchange visible but out of the next request context', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('Bad gateway', { status: 502 })).mockResolvedValueOnce(answer('Yanıt'));
  vi.stubGlobal('fetch', fetcher);
  await act(async () => { renderer = create(createElement(Harness)); });
  await act(async () => { await state.sendMessage('Eski soru'); });
  await act(async () => { await state.sendMessage('Yeni soru'); });
  expect(state.messages).toHaveLength(4);
  expect(JSON.parse(fetcher.mock.calls[1][1].body).messages).toEqual([{ role: 'user', content: 'Yeni soru' }]);
});
it('stops a pending request, prevents duplicate sends, and allows retry', async () => {
  const fetcher = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new Error('cancel')))));
  vi.stubGlobal('fetch', fetcher);
  await act(async () => { renderer = create(createElement(Harness)); });
  let request!: Promise<void>;
  await act(async () => { request = state.sendMessage('Sorum'); await state.sendMessage('Çift tıklama'); });
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => { state.stop(); await request; });
  expect(state.loading).toBe(false);
  expect(state.messages.at(-1)?.error).toContain('durduruldu');
  expect(state.messages.at(-1)?.retry).toBe('Sorum');
});
it('bounds long questions before a request and aborts on navigation away', async () => {
  let signal: AbortSignal;
  vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
    signal = options.signal!; signal.addEventListener('abort', () => reject(new Error('cancel')));
  })));
  await act(async () => { renderer = create(createElement(Harness)); });
  await act(async () => { await state.sendMessage('x'.repeat(CHAT_MESSAGE_LIMIT + 1)); });
  expect(fetch).not.toHaveBeenCalled(); expect(state.inputError).toContain('6000');
  let request!: Promise<void>;
  await act(async () => { request = state.sendMessage('Sorum'); });
  await act(async () => { renderer.unmount(); await request; });
  expect(signal!.aborted).toBe(true);
});
