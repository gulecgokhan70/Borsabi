/* Haber Analiz Motoru - AI destekli piyasa etki analizi */

export interface StockWarning {
  symbol: string;
  warning: 'GİR' | 'GİRME' | 'DİKKATLİ OL';
  reason: string;
  impact: number; // -10 to +10
}

export interface SectorImpact {
  sector: string;
  direction: 'yukarı' | 'aşağı' | 'nötr';
  reason: string;
}

export interface NewsImpact {
  overallSentiment: 'olumlu' | 'olumsuz' | 'karışık' | 'nötr';
  riskLevel: 'Düşük' | 'Orta' | 'Yüksek';
  summary: string;
  criticalWarnings: string[];
  sectorImpacts: SectorImpact[];
  stockWarnings: StockWarning[];
  analyzedAt: string;
}

/* ── Cache ── */
let analysisCache: { data: NewsImpact; ts: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 dakika

/* ── Haberleri çek ── */
async function fetchNewsForAnalysis(baseUrl: string): Promise<string> {
  try {
    const res = await fetch(`${baseUrl}/api/news?limit=25`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return '';
    const data = await res.json();
    const news = data?.news ?? [];
    if (news.length === 0) return '';

    return news.map((n: any, i: number) =>
      `${i + 1}. [${n.category?.toUpperCase() ?? 'GENEL'}] ${n.title}${n.summary ? ' - ' + n.summary : ''} (Kaynak: ${n.source ?? 'Bilinmiyor'})`
    ).join('\n');
  } catch {
    return '';
  }
}

/* ── AI ile analiz ── */
async function analyzeWithAI(newsText: string): Promise<NewsImpact> {
  const apiKey = process.env.ABACUSAI_API_KEY;
  if (!apiKey) throw new Error('API key bulunamadı');

  const systemPrompt = `Sen bir finansal haber analisti ve borsa uzmanısın. Türkiye piyasalarını (BIST, döviz, kripto) çok iyi biliyorsun.

Sana verilen haberleri analiz edip JSON formatında cevap ver. Analiz şunları içermeli:

1. overallSentiment: Genel piyasa hissiyatı ("olumlu", "olumsuz", "karışık", "nötr")
2. riskLevel: Piyasa risk seviyesi ("Düşük", "Orta", "Yüksek")
3. summary: 1-2 cümlelik genel değerlendirme
4. criticalWarnings: Kritik uyarılar dizisi (en fazla 3 madde)
5. sectorImpacts: Etkilenen sektörler dizisi (en fazla 5)
   - sector: Sektör adı
   - direction: "yukarı" veya "aşağı" veya "nötr"
   - reason: Kısa sebep
6. stockWarnings: Belirli hisselere yönelik uyarılar (en fazla 8)
   - symbol: Hisse kodu (THYAO, GARAN, EREGL vb.)
   - warning: "GİR" (olumlu), "GİRME" (olumsuz), "DİKKATLİ OL" (riskli)
   - reason: 1 cümle sebep
   - impact: -10 ile +10 arası etki puanı

Önemli BIST hisseleri: THYAO, GARAN, AKBNK, YKBNK, EREGL, ASELS, KCHOL, BIMAS, SAHOL, TUPRS, SISE, TAVHL, PETKM, TCELL, ENKAI, HEKTS, FROTO, TOASO, KOZAL, GUBRF, TTKOM, VESTL, MGROS, DOHOL, ARCLK, TKFEN, PGSUS, SASA, EUPWR

Sadece haberlerde gerçekten değinilen veya doğrudan etkilenecek hisseler için uyarı ver. Tahmin etme.

JSON formatında cevap ver, başka bir şey yazma.`;

  const userPrompt = `Aşağıdaki güncel Türkiye finans haberlerini analiz et:\n\n${newsText}`;

  const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-5.4-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('AI analysis error:', err);
    throw new Error('AI analiz hatası');
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI boş cevap döndü');

  const parsed = JSON.parse(content);

  return {
    overallSentiment: parsed.overallSentiment ?? 'nötr',
    riskLevel: parsed.riskLevel ?? 'Orta',
    summary: parsed.summary ?? 'Analiz tamamlandı.',
    criticalWarnings: parsed.criticalWarnings ?? [],
    sectorImpacts: (parsed.sectorImpacts ?? []).slice(0, 5),
    stockWarnings: (parsed.stockWarnings ?? []).slice(0, 8),
    analyzedAt: new Date().toISOString(),
  };
}

/* ── Ana fonksiyon: Haber analizi al (cache'li) ── */
export async function getNewsImpact(baseUrl: string): Promise<NewsImpact | null> {
  // Cache kontrol
  if (analysisCache && Date.now() - analysisCache.ts < CACHE_TTL) {
    return analysisCache.data;
  }

  try {
    const newsText = await fetchNewsForAnalysis(baseUrl);
    if (!newsText) return null;

    const analysis = await analyzeWithAI(newsText);
    analysisCache = { data: analysis, ts: Date.now() };
    return analysis;
  } catch (e) {
    console.error('News analysis error:', e);
    // Cache varsa eski veriyi dön
    if (analysisCache) return analysisCache.data;
    return null;
  }
}

/* ── Yardımcı: Hisse için haber uyarısı bul ── */
export function getStockNewsWarning(impact: NewsImpact | null, symbol: string): StockWarning | null {
  if (!impact) return null;
  const clean = symbol.replace('.IS', '').replace('-USD', '').toUpperCase();
  return impact.stockWarnings.find(w => w.symbol.toUpperCase() === clean) ?? null;
}

/* ── Yardımcı: Teknik puanı haber etkisiyle düzelt ── */
export function adjustScoreWithNews(score: number, impact: NewsImpact | null, symbol: string): number {
  const warning = getStockNewsWarning(impact, symbol);
  if (!warning) return score;
  const adjustment = Math.min(10, Math.max(-10, warning.impact));
  return Math.max(0, Math.min(100, score + adjustment));
}
