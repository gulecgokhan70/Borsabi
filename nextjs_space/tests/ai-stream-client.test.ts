import { expect, it, vi } from 'vitest';
import { readAIStream, aiHttpError } from '../lib/ai-stream-client';
import { chatStreamResponse } from '../lib/ai-chat-stream';
const chunk = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n`;
it('reads split UTF-8 chunks and an unterminated DONE line', async () => {
  const bytes = new TextEncoder().encode(chunk('Türkçe yanıt') + 'data: [DONE]');
  const response = new Response(new ReadableStream({ start(c) { for (const b of bytes) c.enqueue(new Uint8Array([b])); c.close(); } }));
  const update = vi.fn();
  expect(await readAIStream(response, update)).toBe('Türkçe yanıt');
  expect(update).toHaveBeenLastCalledWith('Türkçe yanıt');
});
it('rejects empty, interrupted, invalid and provider-error streams', async () => {
  for (const body of ['', chunk('Yarım'), 'data: {bad}\n', 'data: {"error":"secret"}\n']) {
    await expect(readAIStream(new Response(body), vi.fn())).rejects.toThrow();
  }
});
it('turns proxy and session failures into actionable messages without echoing HTML', () => {
  expect(aiHttpError(401)).toContain('giriş'); expect(aiHttpError(429)).toContain('bekleyip');
  expect(aiHttpError(504)).toContain('zamanında'); expect(aiHttpError(502)).toContain('ulaşılamıyor');
});

it('reads byte-split Unicode source metadata without treating it as answer text', async () => {
  const source = { label: 'Şirket haberi', url: 'https://example.com/haber', asOf: null, status: 'Zamanı bilinmiyor' };
  const bytes = new TextEncoder().encode(`data: ${JSON.stringify({ type: 'sources', sources: [source, { ...source, url: 'javascript:alert(1)' }] })}\n\n${chunk('Türkçe yanıt')}data: [DONE]`);
  const response = new Response(new ReadableStream({ start(c) { for (const b of bytes) c.enqueue(new Uint8Array([b])); c.close(); } }));
  const update = vi.fn(), metadata = vi.fn();
  expect(await readAIStream(response, update, metadata)).toBe('Türkçe yanıt');
  expect(metadata).toHaveBeenCalledExactlyOnceWith([source]);
  expect(update).toHaveBeenCalledExactlyOnceWith('Türkçe yanıt');
  await expect(readAIStream(chatStreamResponse(new Response('data: [DONE]\n'), [source]), vi.fn())).rejects.toThrow('incomplete');
});

it('forwards cancellation to the provider and releases its stream', async () => {
  const cancel = vi.fn();
  const upstream = new Response(new ReadableStream({ cancel }));
  const response = chatStreamResponse(upstream, []);
  const reader = response.body!.getReader();
  await reader.read(); // Metadata; the next pull may be waiting on upstream.
  await reader.cancel('user left');
  expect(cancel).toHaveBeenCalledExactlyOnceWith('user left');
  expect(upstream.body!.locked).toBe(false);
});

it('propagates provider stream failures instead of returning a completed answer', async () => {
  const upstream = new Response(new ReadableStream({ pull(c) { c.error(new Error('upstream disconnected')); } }));
  await expect(readAIStream(chatStreamResponse(upstream, []), vi.fn())).rejects.toThrow('upstream disconnected');
  expect(upstream.body!.locked).toBe(false);
});

it('finishes at the terminal event even if the server keeps the connection open', async () => {
  const cancel = vi.fn();
  const response = new Response(new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode(chunk('Bitti') + 'data: [DONE]\n\n')); }, cancel,
  }));
  expect(await readAIStream(response, vi.fn())).toBe('Bitti');
  expect(cancel).toHaveBeenCalled();
});
it('marks token-limited answers as incomplete, retaining text already received', async () => {
  const onText = vi.fn();
  const response = new Response(chunk('Kısmi') + 'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n');
  await expect(readAIStream(response, onText)).rejects.toThrow('incomplete');
  expect(onText).toHaveBeenLastCalledWith('Kısmi');
});
