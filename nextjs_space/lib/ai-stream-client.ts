import { safeSourceUrl, type EvidenceSource } from './evidence';

export function parseStreamSources(value: unknown): EvidenceSource[] {
  if (!Array.isArray(value)) return [];
  return value.filter((source): source is EvidenceSource =>
    source && typeof source.label === 'string' && typeof source.status === 'string'
    && (source.asOf === null || (typeof source.asOf === 'string' && Number.isFinite(Date.parse(source.asOf))))
    && typeof source.url === 'string'
    && (safeSourceUrl(source.url) !== null || /^\/[a-z0-9][a-z0-9/_-]*$/i.test(source.url)),
  );
}

export function aiHttpError(status: number) {
  if (status === 401) return 'Oturumunuz sona ermiş. Yeniden giriş yapın.';
  if (status === 413) return 'Mesaj ve analiz verileri çok uzun. Sorunu kısaltıp tekrar deneyebilirsin.';
  if (status === 429) return 'AI hizmeti şu anda yoğun. Biraz bekleyip tekrar deneyin.';
  if (status === 504 || status === 408) return 'Yanıt zamanında alınamadı. Tekrar deneyebilirsiniz.';
  if (status >= 500) return 'AI hizmetine şu anda ulaşılamıyor. Biraz sonra tekrar deneyin.';
  return 'İstek tamamlanamadı. Sorunuzu kontrol edip tekrar deneyin.';
}
export async function readAIStream(response: Response, onText: (text: string) => void, onSources?: (sources: EvidenceSource[]) => void) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('empty');
  const decoder = new TextDecoder();
  let buffer = '', content = '', complete = false;
  function line(value: string) {
    if (!value.startsWith('data:')) return;
    const raw = value.slice(5).trim();
    if (raw === '[DONE]') { complete = true; return; }
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error('invalid-stream'); }
    if (data.error) throw new Error('provider-stream');
    if (data.type === 'sources') { onSources?.(parseStreamSources(data.sources)); return; }
    const finish = data.choices?.[0]?.finish_reason;
    const delta = data.choices?.[0]?.delta?.content;
    if (typeof delta === 'string') { content += delta; onText(content); }
    if (finish === 'stop') complete = true;
    else if (finish) throw new Error('incomplete-stream');
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n'); buffer = lines.pop() || '';
      for (const item of lines) { line(item); if (complete) break; }
      if (complete) break;
      if (done) { if (buffer.trim()) line(buffer); break; }
    }
    if (!content.trim() || !complete) throw new Error('incomplete-stream');
    return content;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
