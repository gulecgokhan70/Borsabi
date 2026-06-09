'use client';
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Send, Loader2, Sparkles, MessageSquare, Trash2 } from 'lucide-react';

const SUGGESTIONS = [
  'THYAO teknik analizi yap',
  'ASELS hissesini değerlendir',
  'Portföyüm nasıl görünüyor?',
  'Bitcoin analizi yap',
  'En güçlü BIST hisseleri hangileri?',
  'SISE ve EREGL karşılaştır',
];

interface ChatMsg {
  role: string;
  content: string;
}

export function AiAssistantClient() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef?.current?.scrollTo?.({ top: scrollRef?.current?.scrollHeight ?? 0, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input)?.trim?.();
    if (!msg || loading) return;
    const userMsg: ChatMsg = { role: 'user', content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessages((prev: ChatMsg[]) => [...prev, { role: 'assistant', content: err?.error ?? 'Bir hata oluştu. Lütfen tekrar deneyin.' }]);
        return;
      }

      const reader = res?.body?.getReader?.();
      if (!reader) return;
      const decoder = new TextDecoder();
      let assistantContent = '';
      let partialRead = '';

      setMessages((prev: ChatMsg[]) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        partialRead += decoder.decode(value, { stream: true });
        const lines = partialRead.split('\n');
        partialRead = lines.pop() ?? '';

        for (const line of lines) {
          if (line?.startsWith?.('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed?.choices?.[0]?.delta?.content ?? '';
              if (delta) {
                assistantContent += delta;
                setMessages((prev: ChatMsg[]) => {
                  const updated = [...prev];
                  if ((updated?.length ?? 0) > 0) {
                    updated[(updated?.length ?? 1) - 1] = { role: 'assistant', content: assistantContent };
                  }
                  return updated;
                });
              }
            } catch (e: any) { /* skip */ }
          }
        }
      }
    } catch (e: any) {
      console.error('AI chat error:', e);
      setMessages((prev: ChatMsg[]) => [...prev, { role: 'assistant', content: 'Bağlantı hatası oluştu. Lütfen tekrar deneyin.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
            <Bot className="w-5 h-5 text-[#3B82F6]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Master AI Asistan</h1>
            <p className="text-xs text-[#94A3B8]">Gerçek verilerle teknik analiz, piyasa önerileri ve risk yönetimi</p>
          </div>
        </div>
        {(messages?.length ?? 0) > 0 && (
          <button onClick={() => setMessages([])} className="p-2 rounded-lg text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors" title="Sohbeti temizle">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 scrollbar-none pb-4">
        {(messages?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 rounded-2xl bg-[#3B82F6]/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-[#3B82F6]" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">Nasıl yardımcı olabilirim?</h2>
            <p className="text-sm text-[#94A3B8] mb-6 text-center max-w-md">Gerçek piyasa verileriyle hisse analizi, teknik göstergeler, portföy değerlendirmesi ve risk yönetimi konularında sorabilirsiniz.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
              {SUGGESTIONS.map((s: string, i: number) => (
                <button key={i} onClick={() => sendMessage(s)} className="flex items-center gap-2 px-4 py-2.5 bg-[#1E293B] border border-[#334155] rounded-lg text-sm text-[#94A3B8] hover:text-white hover:border-[#3B82F6]/50 transition-all text-left">
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-[#3B82F6]" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg: ChatMsg, i: number) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg?.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] lg:max-w-[70%] px-4 py-3 rounded-xl ${
                msg?.role === 'user'
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-[#1E293B] border border-[#334155] text-[#E2E8F0]'
              }`}>
                {msg?.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Bot className="w-3.5 h-3.5 text-[#3B82F6]" />
                    <span className="text-[10px] font-semibold text-[#3B82F6]">Master AI</span>
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg?.content || (loading && i === (messages?.length ?? 1) - 1 ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-[#3B82F6]" /><span className="text-xs text-[#94A3B8]">Piyasa verileri analiz ediliyor...</span></span> : '')}</div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="mt-auto pt-3 border-t border-[#1E293B]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e: any) => setInput(e?.target?.value ?? '')}
            onKeyDown={(e: any) => { if (e?.key === 'Enter' && !e?.shiftKey) { e?.preventDefault?.(); sendMessage(); } }}
            placeholder="Bir soru sorun... Örn: THYAO teknik analizi"
            disabled={loading}
            className="flex-1 px-4 py-3 bg-[#1E293B] border border-[#334155] rounded-xl text-white text-sm placeholder-[#64748B] focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !(input?.trim?.())}
            className="p-3 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-[#3B82F6]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-[10px] text-[#64748B] mt-2 text-center">⚠️ Bu analiz yatırım tavsiyesi değildir. Eğitim ve simülasyon amaçlıdır.</p>
      </div>
    </div>
  );
}
