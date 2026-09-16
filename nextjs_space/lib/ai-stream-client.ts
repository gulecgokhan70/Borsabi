export function aiHttpError(status: number) {
  if (status === 401) return 'Oturumunuz sona ermiş. Yeniden giriş yapın.';
  if (status === 429) return 'AI hizmeti şu anda yoğun. Biraz bekleyip tekrar deneyin.';
  if (status === 504 || status === 408) return 'Yanıt zamanında alınamadı. Tekrar deneyebilirsiniz.';
  if (status >= 500) return 'AI hizmetine şu anda ulaşılamıyor. Biraz sonra tekrar deneyin.';
  return 'İstek tamamlanamadı. Sorunuzu kontrol edip tekrar deneyin.';
}
export async function readAIStream(response: Response, onText: (text: string) => void) {
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
    if (data.choices?.[0]?.finish_reason) complete = true;
    const delta = data.choices?.[0]?.delta?.content;
    if (typeof delta === 'string') { content += delta; onText(content); }
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n'); buffer = lines.pop() || '';
      for (const item of lines) line(item);
      if (done) { if (buffer.trim()) line(buffer); break; }
    }
    if (!content.trim() || !complete) throw new Error('incomplete-stream');
    return content;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
