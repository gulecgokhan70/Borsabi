export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

interface MarketAlert {
  id: string;
  title: string;
  summary: string;
  impact: 'yüksek' | 'orta' | 'düşük';
  direction: 'pozitif' | 'negatif' | 'nötr';
  category: 'gece' | 'gün_içi';
  affectedSectors: string[];
  affectedSymbols: string[];
  actionSuggestion: string;
  source: string;
  timestamp: string;
}

interface AlertsCache {
  alerts: MarketAlert[];
  generatedAt: number;
}

let alertsCache: AlertsCache | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 min

async function fetchNewsForAnalysis(): Promise<string> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/news?limit=30`, {
      headers: { 'User-Agent': 'internal' },
    });
    if (!res.ok) throw new Error('News fetch failed');
    const data = await res.json();
    const news = data.news || [];
    if (news.length === 0) return '';
    return news.map((n: any, i: number) =>
      `${i + 1}. [${n.source}] ${n.title}${n.summary ? ' - ' + n.summary.substring(0, 120) : ''} (${n.date?.substring(0, 16) || 'bilinmiyor'})`
    ).join('\n');
  } catch (e) {
    console.error('fetchNewsForAnalysis error:', e);
    return '';
  }
}

async function generateAlerts(): Promise<MarketAlert[]> {
  const apiKey = process.env.ABACUSAI_API_KEY;
  if (!apiKey) return [];

  const newsText = await fetchNewsForAnalysis();
  if (!newsText) return getDefaultAlerts();

  const now = new Date();
  const hour = now.getUTCHours() + 3; // Turkey is UTC+3
  const isMarketHours = hour >= 10 && hour < 18;

  const prompt = `Sen bir Türk borsası (BIST) uzmanısın. Aşağıdaki güncel haberleri analiz et ve yatırımcıları uyaracak önemli piyasa uyarıları oluştur.

Şu anki saat: ${now.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}
Piyasa durumu: ${isMarketHours ? 'BIST açık' : 'BIST kapalı'}

HABERLER:
${newsText}

Yukarıdaki haberleri analiz ederek EN ÖNEMLİ 3-5 piyasa uyarısı oluştur. Her uyarı için:
- Haberin borsaya etkisini değerlendir
- Etkilenen sektörleri ve hisseleri belirle
- Yatırımcıya kısa bir aksiyon önerisi ver
- Gece mi gün içi mi geliştiğini belirle (saat 18:00-09:30 arası = gece, diğer = gün_içi)

JSON formatında yanıt ver (başka hiçbir metin ekleme):
[
  {
    "title": "Kısa başlık",
    "summary": "2-3 cümle detaylı açıklama",
    "impact": "yüksek|orta|düşük",
    "direction": "pozitif|negatif|nötr",
    "category": "gece|gün_içi",
    "affectedSectors": ["Bankacılık", "Enerji" vb.],
    "affectedSymbols": ["GARAN", "THYAO" vb. BIST sembolleri],
    "actionSuggestion": "Kısa aksiyon önerisi",
    "source": "Kaynak haber sitesi"
  }
]

ÖNEMLİ: Sadece gerçekten önemli ve borsayı etkileyecek haberleri seç. Önemsiz haberleri atla. Eğer yeterince önemli haber yoksa daha az uyarı oluştur.`;

  try {
    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: 'Sen bir finansal haber analisti ve BIST uzmanısın. Sadece JSON formatında yanıt ver.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('LLM API error:', response.status);
      return getDefaultAlerts();
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) {
      console.error('Could not parse LLM JSON response');
      return getDefaultAlerts();
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.map((a: any, i: number) => ({
      id: `alert-${Date.now()}-${i}`,
      title: a.title || 'Piyasa Uyarısı',
      summary: a.summary || '',
      impact: ['yüksek', 'orta', 'düşük'].includes(a.impact) ? a.impact : 'orta',
      direction: ['pozitif', 'negatif', 'nötr'].includes(a.direction) ? a.direction : 'nötr',
      category: a.category === 'gece' ? 'gece' : 'gün_içi',
      affectedSectors: Array.isArray(a.affectedSectors) ? a.affectedSectors.slice(0, 4) : [],
      affectedSymbols: Array.isArray(a.affectedSymbols) ? a.affectedSymbols.slice(0, 5) : [],
      actionSuggestion: a.actionSuggestion || '',
      source: a.source || '',
      timestamp: now.toISOString(),
    }));
  } catch (e) {
    console.error('generateAlerts error:', e);
    return getDefaultAlerts();
  }
}

function getDefaultAlerts(): MarketAlert[] {
  const now = new Date();
  return [{
    id: `default-${Date.now()}`,
    title: 'Haber kaynakları yükleniyor',
    summary: 'Piyasa haberleri analiz ediliyor. Kısa bir süre sonra güncel uyarılar burada görünecek.',
    impact: 'düşük',
    direction: 'nötr',
    category: 'gün_içi',
    affectedSectors: [],
    affectedSymbols: [],
    actionSuggestion: 'Haberleri takip etmeye devam edin.',
    source: 'Sistem',
    timestamp: now.toISOString(),
  }];
}

export async function GET() {
  try {
    // Return cached if fresh
    if (alertsCache && Date.now() - alertsCache.generatedAt < CACHE_TTL) {
      return NextResponse.json({
        alerts: alertsCache.alerts,
        generatedAt: new Date(alertsCache.generatedAt).toISOString(),
        cached: true,
      });
    }

    const alerts = await generateAlerts();
    alertsCache = { alerts, generatedAt: Date.now() };

    return NextResponse.json({
      alerts,
      generatedAt: new Date().toISOString(),
      cached: false,
    }, {
      headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' },
    });
  } catch (e: any) {
    console.error('Market alerts API error:', e);
    return NextResponse.json({ alerts: [], error: e.message }, { status: 500 });
  }
}
