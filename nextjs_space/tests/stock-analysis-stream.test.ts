import { expect, it } from 'vitest';
import { readStockAnalysis } from '../lib/stock-analysis-stream';
it('reads UTF-8 across byte boundaries and accepts an unterminated final result', async () => {
  const result = { genel_gorunum: 'Düşüş eğilimi', trend: 'AŞAĞI' };
  const bytes = new TextEncoder().encode(`data: {"status":"processing"}\n\ndata: ${JSON.stringify({ status: 'completed', result })}`);
  const response = new Response(new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(new Uint8Array([byte])); c.close(); } }));
  expect(await readStockAnalysis(response)).toEqual(result);
  expect(response.body!.locked).toBe(false);
});
it('turns provider errors, incomplete data and missing results into recoverable failures', async () => {
  for (const body of ['', 'data: [DONE]', 'data: {"status":"processing"}', 'data: {"status":"error","message":"secret"}', 'data: {"status":"completed","result":{}}', 'data: {broken']) {
    await expect(readStockAnalysis(new Response(body))).rejects.toThrow(/Tekrar deneyebilirsiniz/);
  }
});
