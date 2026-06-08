export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const SYSTEM_PROMPT = `Sen Master Trader platformunun yapay zeka asistanısın. Adın "Master AI".
Türkçe konuşuyorsun ve Türkiye piyasaları (BIST) ve kripto piyasaları hakkında uzman bilgisine sahipsin.

Görevlerin:
- Teknik analiz (RSI, MACD, EMA20, EMA50, EMA200, Bollinger Bantları)
- Hisse ve kripto analizi
- Trend analizi ve destek/direnç seviyeleri
- Portföy değerlendirmesi ve risk yönetimi
- Eğitim ve strateji önerileri

Kuralların:
1. Her zaman Türkçe yanıt ver
2. Teknik göstergeleri açıkla (RSI aşırı alım/satım, MACD sinyal kesmeleri, EMA trend yönü)
3. Risk uyarıları ver (şlembaşına max %1 risk, günlük max %3 zarar limiti)
4. Destek ve direnç seviyelerini belirt
5. Her yanıtın sonunda mutlaka şu uyarıyı ekle: "\n\n⚠️ Bu analiz yatırım tavsiyesi değildir. Eğitim ve simülasyon amaçlıdır."
6. Profesyonel ve güven veren bir üslup kullan
7. Rakamları ve yüzdeleri net olarak belirt
8. Kısa ve öz yanıtlar ver, gereksiz uzatma

Kullanıcıya her zaman yardımcı ol ve soruları anlaşılır şekilde yanıtla.`;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Oturum gerekli' }), { status: 401 });
    }

    const body = await request.json();
    const { messages } = body ?? {};
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Mesajlar gerekli' }), { status: 400 });
    }

    const apiKey = process.env.ABACUSAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API anahtarı yapılandırılmamış' }), { status: 500 });
    }

    const apiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(messages ?? []).slice(-20),
    ];

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        messages: apiMessages,
        stream: true,
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      console.error('LLM API error:', errText);
      return new Response(JSON.stringify({ error: 'AI yanıtı alınamadı' }), { status: 500 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        if (!reader) { controller.close(); return; }
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (error: any) {
          console.error('Stream error:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('AI Chat error:', error);
    return new Response(JSON.stringify({ error: 'AI asistan hatası' }), { status: 500 });
  }
}
