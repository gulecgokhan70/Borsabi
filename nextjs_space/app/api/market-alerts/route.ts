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

/* ── Haber verilerini topla ── */
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

/* ── Tarama verilerini topla ── */
async function fetchScanData(): Promise<string> {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const sections: string[] = [];

  // Day Trading tarama
  try {
    const res = await fetch(`${baseUrl}/api/day-trading`, { headers: { 'User-Agent': 'internal' } });
    if (res.ok) {
      const data = await res.json();
      const items = (data.data || []).slice(0, 5);
      if (items.length > 0) {
        sections.push('=== DAY TRADING TARAMA (En İyi Fırsatlar) ===');
        items.forEach((s: any, i: number) => {
          const sym = s.symbol?.replace?.('.IS', '') || s.symbol;
          sections.push(`${i + 1}. ${sym} - Puan: ${s.score}, Fiyat: ${s.price}, Değişim: %${(s.changePercent ?? 0).toFixed(1)}, Sinyaller: ${(s.signals || []).slice(0, 4).join(', ')}`);
        });
        sections.push(`Piyasa durumu: ${data.marketOpen ? 'Açık' : 'Kapalı'}`);
      }
    }
  } catch (e) { console.error('Day trading fetch error:', e); }

  // Swing Trading tarama
  try {
    const res = await fetch(`${baseUrl}/api/swing-trading`, { headers: { 'User-Agent': 'internal' } });
    if (res.ok) {
      const data = await res.json();
      const items = (data.data || []).slice(0, 5);
      if (items.length > 0) {
        sections.push('\n=== SWING TRADING TARAMA (En İyi Fırsatlar) ===');
        items.forEach((s: any, i: number) => {
          const sym = s.symbol?.replace?.('.IS', '') || s.symbol;
          sections.push(`${i + 1}. ${sym} - Puan: ${s.score}, Fiyat: ${s.price}, Değişim: %${(s.changePercent ?? 0).toFixed(1)}, Sinyaller: ${(s.signals || []).slice(0, 4).join(', ')}`);
        });
      }
    }
  } catch (e) { console.error('Swing trading fetch error:', e); }

  // Genel tarama (screening)
  try {
    const res = await fetch(`${baseUrl}/api/screening`, { headers: { 'User-Agent': 'internal' } });
    if (res.ok) {
      const data = await res.json();
      const items = (data.data || []).slice(0, 5);
      if (items.length > 0) {
        sections.push('\n=== GENEL TARAMA (Teknik Analiz) ===');
        items.forEach((s: any, i: number) => {
          const sym = s.symbol?.replace?.('.IS', '') || s.symbol;
          const formations = (s.formations || []).join(', ');
          sections.push(`${i + 1}. ${sym} - Puan: ${s.score}, Fiyat: ${s.price}, Değişim: %${(s.changePercent ?? 0).toFixed(1)}${formations ? ', Formasyonlar: ' + formations : ''}, Sinyaller: ${(s.signals || []).slice(0, 4).join(', ')}`);
        });
      }
    }
  } catch (e) { console.error('Screening fetch error:', e); }

  return sections.join('\n');
}

/* ── Akşam analizi verilerini topla ── */
async function fetchAksamAnalizi(): Promise<string> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/aksam-analizi?cached=true`, {
      headers: { 'User-Agent': 'internal' },
    });
    if (!res.ok) return '';
    const data = await res.json();
    if (data.error) return '';

    const sections: string[] = ['=== AKŞAM ANALİZİ ==='];
    sections.push(`Analiz zamanı: ${data.analizZamani || 'bilinmiyor'}`);
    sections.push(`Taranan hisse: ${data.tarananHisse || 0}`);

    // Day trade fırsatları
    const dayItems = (data.dayTrade || []).slice(0, 5);
    if (dayItems.length > 0) {
      sections.push(`\nAkşam Analizi - Day Trade Fırsatları (${data.toplamDayTrade || 0} toplam):`);
      dayItems.forEach((s: any, i: number) => {
        const sym = s.symbol?.replace?.('.IS', '') || s.symbol;
        sections.push(`${i + 1}. ${sym} - Fiyat: ${s.price}, RSI: ${(s.rsi || 0).toFixed(0)}, MACD: ${s.macdHistogram > 0 ? 'Pozitif' : 'Negatif'}, Trend: ${s.trendDirection || 'Belirsiz'}`);
      });
    }

    // Swing trade fırsatları
    const swingItems = (data.swingTrade || []).slice(0, 5);
    if (swingItems.length > 0) {
      sections.push(`\nAkşam Analizi - Swing Trade Fırsatları (${data.toplamSwing || 0} toplam):`);
      swingItems.forEach((s: any, i: number) => {
        const sym = s.symbol?.replace?.('.IS', '') || s.symbol;
        sections.push(`${i + 1}. ${sym} - Fiyat: ${s.price}, RSI: ${(s.rsi || 0).toFixed(0)}, Hedef: ${s.target1}, Stop: ${s.stopLoss}, R/R: ${s.riskReward}`);
      });
    }

    return sections.join('\n');
  } catch (e) {
    console.error('fetchAksamAnalizi error:', e);
    return '';
  }
}

/* ── LLM ile uyarılar üret ── */
async function generateAlerts(): Promise<MarketAlert[]> {
  const apiKey = process.env.ABACUSAI_API_KEY;
  if (!apiKey) return [];

  // Tüm verileri paralel olarak topla
  const [newsText, scanData, aksamData] = await Promise.allSettled([
    fetchNewsForAnalysis(),
    fetchScanData(),
    fetchAksamAnalizi(),
  ]);

  const news = newsText.status === 'fulfilled' ? newsText.value : '';
  const scans = scanData.status === 'fulfilled' ? scanData.value : '';
  const aksam = aksamData.status === 'fulfilled' ? aksamData.value : '';

  // Hiç veri yoksa varsayılan döndür
  if (!news && !scans && !aksam) return getDefaultAlerts();

  const now = new Date();
  const hour = now.getUTCHours() + 3; // Turkey UTC+3
  const isMarketHours = hour >= 10 && hour < 18;

  const prompt = `Sen bir Türk borsası (BIST) uzmanısın. Aşağıdaki güncel verileri analiz et ve yatırımcıları uyaracak önemli piyasa uyarıları oluştur.

Şu anki saat: ${now.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}
Piyasa durumu: ${isMarketHours ? 'BIST açık' : 'BIST kapalı'}

${news ? '📰 HABERLER:\n' + news + '\n\n' : ''}${scans ? '📊 TARAMA SİSTEMLERİ:\n' + scans + '\n\n' : ''}${aksam ? '🌙 ' + aksam + '\n\n' : ''}Yukarıdaki TÜM verileri (haberler + tarama sonuçları + akşam analizi) birlikte değerlendirerek EN ÖNEMLİ 3-6 piyasa uyarısı oluştur.

Uyarı türleri:
1. HABER BAZLI: Önemli haberlerin piyasaya etkisi
2. TEKNİK: Tarama sistemlerinden gelen güçlü teknik sinyaller (formasyon, hacim patlaması, trend kırılımı vb.)
3. FIRSATLAR: Day trade veya swing trade için öne çıkan hisseler
4. RİSK: Aşırı alım/satım, negatif MACD, düşüş trendi gibi uyarılar
5. AKŞAM ANALİZİ: Gece gelişmeleri ve ertesi gün için beklentiler

Her uyarı için:
- Haberin ve/veya teknik verinin borsaya etkisini değerlendir
- Etkilenen sektörleri ve hisseleri belirle
- Yatırımcıya kısa bir aksiyon önerisi ver
- Gece mi gün içi mi geliştiğini belirle

JSON formatında yanıt ver (başka hiçbir metin ekleme):
[
  {
    "title": "Kısa başlık",
    "summary": "2-3 cümle detaylı açıklama. Haberleri ve teknik verileri birlikte yorumla.",
    "impact": "yüksek|orta|düşük",
    "direction": "pozitif|negatif|nötr",
    "category": "gece|gün_içi",
    "affectedSectors": ["Bankacılık", "Enerji" vb.],
    "affectedSymbols": ["GARAN", "THYAO" vb. BIST sembolleri],
    "actionSuggestion": "Kısa aksiyon önerisi",
    "source": "Haber/Teknik Analiz/Akşam Analizi"
  }
]

ÖNEMLİ KURALLAR:
- Sadece gerçekten önemli ve borsayı etkileyecek haberleri seç
- Tarama sistemlerinden gelen güçlü sinyalleri (80+ puan, formasyon tespitleri) mutlaka dahil et
- Akşam analizi verilerini ertesi gün beklentileri için kullan
- Aynı hisseyi birden fazla uyarıda tekrarlama
- Eğer yeterince önemli veri yoksa daha az uyarı oluştur`;

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
          { role: 'system', content: 'Sen bir finansal haber analisti ve BIST uzmanısın. Haber akışı, teknik tarama sonuçları ve akşam analizini birleştirerek kapsamlı piyasa uyarıları oluşturursun. Sadece JSON formatında yanıt ver.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 3000,
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
    title: 'Veriler analiz ediliyor',
    summary: 'Haberler, tarama sonuçları ve akşam analizi birlikte değerlendiriliyor. Kısa bir süre sonra güncel uyarılar burada görünecek.',
    impact: 'düşük',
    direction: 'nötr',
    category: 'gün_içi',
    affectedSectors: [],
    affectedSymbols: [],
    actionSuggestion: 'Haberleri ve teknik analizleri takip etmeye devam edin.',
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
