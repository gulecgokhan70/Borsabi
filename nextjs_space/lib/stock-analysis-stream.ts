/** Stock-analysis endpoint emits a completed JSON result, not text deltas. */
export async function readStockAnalysis(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Analiz yanıtı boş. Tekrar deneyebilirsiniz.');
  const decoder = new TextDecoder();
  let buffer = '';
  const parse = (line: string) => {
    if (!line.startsWith('data:')) return;
    const raw = line.slice(5).trim();
    if (!raw || raw === '[DONE]') return;
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error('Analiz yanıtı okunamadı. Tekrar deneyebilirsiniz.'); }
    if (data.status === 'error') throw new Error('Analiz tamamlanamadı. Tekrar deneyebilirsiniz.');
    if (data.status === 'completed' && typeof data.result?.genel_gorunum === 'string' && data.result.genel_gorunum.trim()) return data.result;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n'); buffer = lines.pop() || '';
      for (const line of lines) { const result = parse(line); if (result) return result; }
      if (done) { const result = parse(buffer); if (result) return result; break; }
    }
    throw new Error('Analiz yanıtı tamamlanmadı. Tekrar deneyebilirsiniz.');
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
