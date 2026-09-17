import type { EvidenceSource } from './evidence';

export const CHAT_DATA_TIMEOUT_MS = 8_000;
export type ChatDataTask = {
  label: string;
  run: (sources: EvidenceSource[]) => Promise<string>;
};

/** Shared feed/cache requests may finish later, but cannot mutate this answer. */
export async function collectChatData(tasks: ChatDataTask[], signal: AbortSignal) {
  signal.throwIfAborted();
  const results: ({ text: string; sources: EvidenceSource[] } | undefined)[] = tasks.map(() => undefined);
  if (!tasks.length) return { text: '', sources: [] as EvidenceSource[] };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  let closed = false;
  const pending = tasks.map(async (task, index) => {
    const sources: EvidenceSource[] = [];
    try {
      const text = await task.run(sources);
      if (!closed && text.trim()) results[index] = { text, sources: [...sources] };
    } catch { /* Unavailable context must not prevent a chat response. */ }
  });
  try {
    await Promise.race([
      Promise.all(pending),
      new Promise<void>(resolve => { timer = setTimeout(resolve, CHAT_DATA_TIMEOUT_MS); }),
      new Promise<never>((_, reject) => {
        onAbort = () => reject(signal.reason);
        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) onAbort();
      }),
    ]);
    signal.throwIfAborted();
    const missing = tasks.filter((_, index) => !results[index]).map(task => task.label);
    return {
      text: [
        ...results.flatMap(result => result ? [result.text] : []),
        ...(missing.length ? [`Veri alınamadı veya zamanında tamamlanmadı: ${missing.join(', ')}. Bu verileri sıfır ya da güncel kabul etme; eksikliği kullanıcıya açıkla, rakam veya haber uydurma.`] : []),
      ].join('\n\n'),
      sources: results.flatMap(result => result?.sources ?? []),
    };
  } finally {
    closed = true;
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}
