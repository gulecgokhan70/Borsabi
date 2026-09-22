'use client';
import { useEffect, useRef, useState } from 'react';
import { aiHttpError, parseStreamSources, readAIStream } from '@/lib/ai-stream-client';
import { CHAT_HISTORY_LIMIT, CHAT_MESSAGE_LIMIT } from '@/lib/chat-context';
import type { EvidenceSource } from '@/lib/evidence';

export interface ChatMsg {
  role: 'user' | 'assistant'; content: string; sources?: EvidenceSource[];
  error?: string; retry?: string;
}
export function useAIConversation() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [inputError, setInputError] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { const pending = active.current; active.current = null; pending?.abort(); }, []);

  const sendMessage = async (text?: string, retryIndex?: number) => {
    const msg = (text ?? input).trim();
    if (!msg || active.current) return;
    if (msg.length > CHAT_MESSAGE_LIMIT) { setInputError(`Sorunu ${CHAT_MESSAGE_LIMIT} karakterden kısa yazabilirsin.`); return; }
    setInputError('');
    const history = retryIndex === undefined ? messages : messages.slice(0, Math.max(0, retryIndex - 1));
    const visible: ChatMsg[] = [...history, { role: 'user', content: msg }];
    // Failed/partial exchanges remain visible, but are not facts in the next model context.
    const context = history.filter((m, i) => !m.error && !(m.role === 'user' && history[i + 1]?.error));
    const controller = new AbortController(); active.current = controller;
    const valid = () => active.current === controller;
    let timedOut = false, partial = '';
    let sources: EvidenceSource[] = [];
    const publish = (error?: string) => { if (valid()) setMessages([...visible, { role: 'assistant', content: partial, sources, ...(error ? { error, retry: msg } : {}) }]); };
    publish();
    if (retryIndex === undefined) setInput('');
    setLoading(true);
    const deadline = setTimeout(() => { timedOut = true; controller.abort(); }, 120_000);
    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...context, { role: 'user', content: msg }]
          .filter(m => m.content.trim()).slice(-CHAT_HISTORY_LIMIT)
          .map(({ role, content }) => ({ role, content: content.slice(0, CHAT_MESSAGE_LIMIT) })) }),
      });
      if (!valid()) { await res.body?.cancel(); return; }
      if (!res.ok) { await res.body?.cancel(); publish(aiHttpError(res.status)); return; }
      try { sources = parseStreamSources(JSON.parse(decodeURIComponent(res.headers.get('X-BorsaBi-Sources') || '%5B%5D'))); } catch { /* Legacy metadata is optional. */ }
      await readAIStream(res, content => { partial = content; publish(); }, value => { sources = value; publish(); });
      if (controller.signal.aborted) publish(timedOut ? 'Yanıt zamanında tamamlanamadı. Tekrar deneyebilirsin.' : 'Yanıt durduruldu. İstersen yeniden deneyebilirsin.');
    } catch {
      publish(controller.signal.aborted
        ? timedOut ? 'Yanıt zamanında tamamlanamadı. Tekrar deneyebilirsin.' : 'Yanıt durduruldu. İstersen yeniden deneyebilirsin.'
        : 'Yanıt tamamlanamadı. Bağlantını kontrol edip tekrar deneyebilirsin.');
    } finally {
      clearTimeout(deadline);
      if (valid()) { active.current = null; setLoading(false); }
    }
  };
  return { messages, input, setInput, loading, inputError, sendMessage,
    stop: () => active.current?.abort(),
    clear: () => { if (!active.current) { setMessages([]); setInputError(''); } },
  };
}
