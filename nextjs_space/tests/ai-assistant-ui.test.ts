import { createElement } from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('framer-motion', () => ({ motion: { div: 'div' } }));
vi.mock('../components/ai-markdown', () => ({ AIMarkdown: ({ content }: { content: string }) => createElement('p', null, content) }));
vi.mock('../components/report-ai-response', () => ({ ReportAIResponse: () => createElement('button', null, 'Yanıtı bildir') }));
import { AiAssistantClient } from '../app/ai-assistant/ai-assistant-client';
import { chatStreamResponse } from '../lib/ai-chat-stream';
let renderer: ReactTestRenderer;
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(text).join('');
afterEach(async () => { await act(async () => renderer?.unmount()); vi.unstubAllGlobals(); });
it('prefills the selected stock for deeper analysis without sending a paid request automatically', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('window', { location: { search: '?symbol=ONRYT.IS' } });
  await act(async () => { renderer = create(createElement(AiAssistantClient)); });
  expect(renderer.root.findByType('input').props.value).toContain('ONRYT.IS analizini derinleştir');
  expect(fetcher).not.toHaveBeenCalled();
});
it('submits a manually typed question and renders sources received in the answer stream', async () => {
  const fetcher = vi.fn().mockResolvedValue(chatStreamResponse(
    new Response('data: {"choices":[{"delta":{"content":"Piyasa özeti"}}]}\n\ndata: [DONE]'),
    [{ label: 'Haber kaynağı', url: 'https://example.com/haber', asOf: null, status: 'Kaynak zamanı bilinmiyor' }],
  ));
  vi.stubGlobal('fetch', fetcher);
  await act(async () => { renderer = create(createElement(AiAssistantClient)); });
  await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: 'Borsa durumu' } }));
  await act(async () => renderer.root.findByType('input').props.onKeyDown({ key: 'Enter', preventDefault: vi.fn() }));
  await act(async () => {});
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetcher.mock.calls[0][1].body).messages).toEqual([{ role: 'user', content: 'Borsa durumu' }]);
  expect(text(renderer.root)).toContain('Piyasa özeti');
  expect(renderer.root.findByType('a').props.href).toBe('https://example.com/haber');
  expect(text(renderer.root)).not.toContain('ulaşılamıyor');
});
it('retries a proxy failure with the original question exactly once and never sends the error as history', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('<html>502</html>', { status: 502 })).mockResolvedValueOnce(new Response('data: {"choices":[{"delta":{"content":"Yanıt"}}]}\n\ndata: [DONE]'));
  vi.stubGlobal('fetch', fetcher);
  await act(async () => { renderer = create(createElement(AiAssistantClient)); });
  await act(async () => renderer.root.findAllByType('button').find(b => text(b) === 'Bugün borsa nasıldı?')!.props.onClick());
  expect(text(renderer.root)).toContain('AI hizmetine şu anda ulaşılamıyor');
  expect(text(renderer.root)).not.toContain('Yanıtı bildir');
  const retry = renderer.root.findAllByType('button').find(b => text(b) === 'Tekrar dene')!;
  await act(async () => { await Promise.all([retry.props.onClick(), retry.props.onClick()]); });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetcher.mock.calls[1][1].body).messages).toEqual([{ role: 'user', content: 'Bugün borsa nasıldı?' }]);
  expect(text(renderer.root)).toContain('Yanıtı bildir');
  expect(text(renderer.root)).not.toContain('ulaşılamıyor');
});
