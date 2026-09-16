import { expect, it, vi } from 'vitest';
import { readAIStream, aiHttpError } from '../lib/ai-stream-client';
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
