import type { EvidenceSource } from './evidence';

/** Put potentially large, Unicode source metadata in the body, never headers. */
export function chatStreamResponse(upstream: Response, sources: EvidenceSource[]) {
  const reader = upstream.body?.getReader();
  if (!reader) throw new Error('Missing AI response body');
  let first = true;
  let released = false;
  const release = () => { if (!released) { released = true; reader.releaseLock(); } };
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (first) {
        first = false;
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`));
        return;
      }
      try {
        const { done, value } = await reader.read();
        if (done) { controller.close(); release(); }
        else controller.enqueue(value);
      } catch (error) { controller.error(error); release(); }
    },
    async cancel(reason) {
      try { await reader.cancel(reason); } finally { release(); }
    },
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'private, no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
