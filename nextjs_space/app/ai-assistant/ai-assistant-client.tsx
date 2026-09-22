'use client';
import { useAIConversation, type ChatMsg } from '@/hooks/use-ai-conversation';
import { AIMarkdown } from '@/components/ai-markdown';
import { useRef, useEffect } from 'react';
import { ReportAIResponse } from '@/components/report-ai-response';
import { CHAT_MESSAGE_LIMIT } from '@/lib/chat-context';
import { motion } from 'framer-motion';
import { Bot, Send, Loader2, Sparkles, MessageSquare, Trash2 } from 'lucide-react';

const SUGGESTIONS = [
  'Bugün borsa nasıldı?',
  'THYAO teknik analizi yap',
  'En güçlü BIST hisseleri hangileri?',
  'Portföyümü risk açısından değerlendir',
  'RSI nedir ve nasıl kullanılır?',
  'Bitcoin ve kripto piyasası analizi yap',
  'Dolar/TL için teknik görünüm nasıl?',
  'En yüksek hacimli hisseler hangileri?',
  'Swing trade fırsatları var mı?',
  'Stop loss nasıl belirlenir?',
  'Bollinger Bantları ile strateji öner',
  'MACD göstergesini nasıl okurum?',
  'Altın yatırımı hakkında bilgi ver',
  'Sektörel bazda en iyi performans gösteren hisseler',
  'Destek ve direnç seviyeleri nasıl hesaplanır?',
  'Bugün için açılış öncesi piyasa analizi yap',
];

export function AiAssistantClient() {
  const { messages, input, setInput, loading, inputError, sendMessage, stop, clear } = useAIConversation();
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const symbol = new URLSearchParams(window.location.search).get('symbol');
    if (symbol && /^[A-Z0-9.^=-]{1,24}$/.test(symbol)) setInput(`${symbol} analizini derinleştir. Fiyat hareketi, haberler ve riskleri kaynak zamanlarıyla açıkla.`);
  }, [setInput]);

  useEffect(() => {
    scrollRef?.current?.scrollTo?.({ top: scrollRef?.current?.scrollHeight ?? 0, behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
            <Bot className="w-5 h-5 text-[#3B82F6]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">BorsaBi AI Asistan</h1>
            <p className="text-xs text-muted-foreground">Gerçek verilerle teknik analiz, piyasa önerileri ve risk yönetimi</p>
          </div>
        </div>
        {(messages?.length ?? 0) > 0 && (
          <button disabled={loading} onClick={clear} className="p-2 rounded-lg text-muted-foreground hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors" title="Sohbeti temizle" aria-label="Sohbeti temizle">
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
            <h2 className="text-lg font-semibold text-foreground mb-1">Nasıl yardımcı olabilirim?</h2>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">Gerçek piyasa verileriyle hisse analizi, teknik göstergeler, portföy değerlendirmesi ve risk yönetimi konularında sorabilirsiniz.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-w-3xl w-full">
              {SUGGESTIONS.map((s: string, i: number) => (
                <button key={i} onClick={() => sendMessage(s)} className="flex items-center gap-2 px-4 py-2.5 glass-card rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-[#3B82F6]/50 transition-all text-left">
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-[#3B82F6]" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg: ChatMsg, i: number) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg?.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`min-w-0 max-w-[85%] lg:max-w-[70%] px-4 py-3 rounded-xl ${
                msg?.role === 'user'
                  ? 'bg-[#3B82F6] text-white'
                  : 'glass-card text-foreground'
              }`}>
                {msg?.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Bot className="w-3.5 h-3.5 text-[#3B82F6]" />
                    <span className="text-[10px] font-semibold text-[#3B82F6]">BorsaBi AI</span>
                  </div>
                )}
                {msg.role === 'assistant' && msg.content ? <AIMarkdown content={msg.content} /> : <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg?.content || (loading && i === (messages?.length ?? 1) - 1 ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-[#3B82F6]" /><span className="text-xs text-muted-foreground">Piyasa verileri analiz ediliyor...</span></span> : '')}</div>}
                {msg.error && <p role="alert" className="mt-2 text-sm text-amber-600 dark:text-amber-400">{msg.content && 'Bu yanıt yarım kaldı. '}{msg.error}</p>}
                {msg.role === 'assistant' && !msg.error && !(loading && i === messages.length - 1) && <ReportAIResponse content={msg.content} source="ai-assistant" />}
                {msg.error && i === messages.length - 1 && <button disabled={loading} onClick={() => sendMessage(msg.retry, i)} className="min-h-[44px] text-sm text-blue-500 underline">Tekrar dene</button>}
                {!!msg.sources?.length && <details className="mt-3 text-xs border-t border-white/10 pt-2"><summary className="min-h-[44px] cursor-pointer">Kullanılan veri kaynakları</summary>{msg.sources.map((source, index) => <div key={index} className="py-2"><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-[#3B82F6] underline">{source.label}</a><p>{source.asOf ? new Date(source.asOf).toLocaleString('tr-TR') : 'Kaynak zamanı bilinmiyor'}</p><p>{source.status}</p></div>)}</details>}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="mt-auto pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e: any) => setInput(e?.target?.value ?? '')}
            onKeyDown={(e: any) => { if (e?.key === 'Enter' && !e?.shiftKey && !e.nativeEvent?.isComposing) { e?.preventDefault?.(); sendMessage(); } }}
            placeholder="Bir soru sorun... Örn: THYAO teknik analizi"
            aria-label="AI asistanına sorunuz"
            maxLength={CHAT_MESSAGE_LIMIT}
            aria-describedby={inputError ? "chat-input-error" : undefined}
            className="min-w-0 flex-1 px-4 py-3 glass-card rounded-xl text-foreground text-sm placeholder-[#64748B] focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none disabled:opacity-50"
          />
          <button
            onClick={() => loading ? stop() : sendMessage()}
            aria-label={loading ? "Yanıtı durdur" : "Soruyu gönder"}
            disabled={!loading && !(input?.trim?.())}
            className="p-3 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-[#3B82F6]"
          >
            {loading ? <span className="text-xs">Durdur</span> : <Send className="w-5 h-5" />}
          </button>
        </div>
        {inputError && <p id="chat-input-error" role="alert" className="text-sm text-amber-600">{inputError}</p>}
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 text-center">⚠️ Bu analiz yatırım tavsiyesi değildir. Eğitim ve simülasyon amaçlıdır.</p>
      </div>
    </div>
  );
}
