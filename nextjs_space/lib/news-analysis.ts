/**
 * Haber Analiz Motoru
 * Borsayı etkileyen haberleri çeker, LLM ile analiz eder ve
 * hisse bazında işleme gir/girme uyarısı üretir.
 */

interface NewsItem {
  title: string;
  summary: string;
  source: string;
  category: string;
  sentiment?: string;
  importance?: number;
  date: string;
}

export interface NewsImpact {
  genelDurum: 'pozitif' | 'negatif' | 'nötr';
  genelAciklama: string;
  riskSeviyesi: 'düşük' | 'orta' | 'yüksek';
  kritikUyarilar: string[];
  sektorEtkileri: Array<{
    sektor: string;
    etki: 'pozitif' | 'negatif' | 'nötr';
    aciklama: string;
  }>;
  hisseUyarilari: Array<{
    sembol: string;
    uyari: 'GİR' | 'GİRME' | 'DİKKATLİ OL';
    sebep: string;
  }>;
  pileseFaktoru: number; // -10 ile +10 arası, puana eklenir/çıkarılır
  analizZamani: string;
}

// Cache
let newsImpactCache: { data: NewsImpact; ts: number } | null = null;
const NEWS_IMPACT_TTL = 30 * 60 * 1000; // 30 dakika

/**
 * Haberleri API'den çek
 */
async function fetchLatestNews(baseUrl?: string): Promise<NewsItem[]> {
  try {
    const url = baseUrl
      ? `${baseUrl}/api/news?limit=25`
      : '/api/news?limit=25';
    
    // Server-side'da tam URL gerekli
    const fullUrl = url.startsWith('http') ? url : `http://localhost:${process.env.PORT || 3000}${url}`;
    const res = await fetch(fullUrl, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.news ?? [];
  } catch (e) {
    console.error('[NewsAnalysis] Haber çekme hatası:', e);
    return [];
  }
}

/**
 * LLM ile haberleri analiz et ve piyasa etkisi çıkar
 */
async function analyzeNewsWithLLM(news: NewsItem[]): Promise<NewsImpact | null> {
  const apiKey = process.env.ABACUSAI_API_KEY;
  if (!apiKey) {
    console.error('[NewsAnalysis] API key yok');
    return null;
  }

  if (news.length === 0) {
    return {
      genelDurum: 'nötr',
      genelAciklama: 'Güncel haber verisi bulunamadı.',
      riskSeviyesi: 'düşük',
      kritikUyarilar: [],
      sektorEtkileri: [],
      hisseUyarilari: [],
      pileseFaktoru: 0,
      analizZamani: new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }),
    };
  }

  // Haberleri özet formatına dönüştür
  const haberOzet = news.slice(0, 20).map((n, i) => 
    `${i + 1}. [${n.source}] ${n.title}${n.summary ? ' - ' + n.summary.substring(0, 100) : ''} (${n.sentiment || 'nötr'}, önem: ${n.importance ?? 0})`
  ).join('\n');

  const prompt = `Sen bir Türk borsa uzmanısın. Aşağıdaki güncel haberleri analiz et ve BIST (Borsa İstanbul) üzerindeki etkilerini değerlendir.

GÜNCEL HABERLER:
${haberOzet}

Aşağıdaki JSON formatında yanıt ver (başka hiçbir metin ekleme, sadece JSON):
{
  "genelDurum": "pozitif" | "negatif" | "nötr",
  "genelAciklama": "Piyasanın genel durumu hakkında 1-2 cümle Türkçe açıklama",
  "riskSeviyesi": "düşük" | "orta" | "yüksek",
  "kritikUyarilar": ["Dikkat edilmesi gereken kritik uyarı mesajları - max 3 adet"],
  "sektorEtkileri": [
    {"sektor": "Bankacılık", "etki": "pozitif" | "negatif" | "nötr", "aciklama": "kısa açıklama"}
  ],
  "hisseUyarilari": [
    {"sembol": "THYAO", "uyari": "GİR" | "GİRME" | "DİKKATLİ OL", "sebep": "kısa sebep"}
  ],
  "pileseFaktoru": 0
}

Kurallar:
- pileseFaktoru: -10 ile +10 arası. Haberler çok olumsuzsa -10, çok olumlu ise +10.
- hisseUyarilari: Sadece haberlerde doğrudan veya dolaylı etkilenen BIST hisselerini yaz. Semboller .IS olmadan (örn: THYAO, GARAN, AKBNK).
- sektorEtkileri: Sadece haberlerde gerçekten etkilenen sektörleri yaz.
- kritikUyarilar: Yatırımcının mutlaka bilmesi gereken risk uyarıları.
- Genel piyasa ortamını değerlendir: faiz kararları, döviz hareketleri, jeopolitik riskler, sektörel gelişmeler.
- "GİRME" uyarısı ver eğer: Şirketle ilgili olumsuz haber varsa, sektörde risk artmışsa, piyasa genel olarak çok olumsuzsa.
- "GİR" uyarısı ver eğer: Şirketle ilgili olumlu haber varsa (temettü, güçlü bilanço, pozitif gelişme).
- "DİKKATLİ OL" uyarısı ver eğer: Belirsizlik yüksekse.`;

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
          { role: 'system', content: 'Sen bir Türk borsa analisti ve haber yorumcususun. Sadece JSON formatında yanıt ver.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('[NewsAnalysis] LLM API error:', response.status);
      return null;
    }

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content ?? '';
    
    // JSON parse et
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[NewsAnalysis] JSON parse edilemedi');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as NewsImpact;
    parsed.analizZamani = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    
    // pileseFaktoru sınırla
    parsed.pileseFaktoru = Math.max(-10, Math.min(10, parsed.pileseFaktoru ?? 0));

    return parsed;
  } catch (e) {
    console.error('[NewsAnalysis] Analiz hatası:', e);
    return null;
  }
}

/**
 * Ana fonksiyon: Haberleri analiz et ve cache'le
 */
export async function getNewsImpact(): Promise<NewsImpact | null> {
  // Cache kontrol
  if (newsImpactCache && (Date.now() - newsImpactCache.ts) < NEWS_IMPACT_TTL) {
    return newsImpactCache.data;
  }

  const news = await fetchLatestNews();
  const impact = await analyzeNewsWithLLM(news);

  if (impact) {
    newsImpactCache = { data: impact, ts: Date.now() };
  }

  return impact;
}

/**
 * Belirli bir hisse için haber uyarısı kontrol et
 */
export function getStockNewsWarning(
  symbol: string,
  impact: NewsImpact | null
): { uyari: 'GİR' | 'GİRME' | 'DİKKATLİ OL' | null; sebep: string | null } {
  if (!impact) return { uyari: null, sebep: null };

  const cleanSymbol = symbol.replace('.IS', '').toUpperCase();
  
  // Direkt hisse uyarısı var mı?
  const hisseUyari = impact.hisseUyarilari?.find(
    h => h.sembol.toUpperCase() === cleanSymbol
  );
  if (hisseUyari) {
    return { uyari: hisseUyari.uyari, sebep: hisseUyari.sebep };
  }

  // Genel piyasa çok negatifse
  if (impact.riskSeviyesi === 'yüksek' && impact.genelDurum === 'negatif') {
    return { uyari: 'DİKKATLİ OL', sebep: 'Piyasa genelinde yüksek risk' };
  }

  return { uyari: null, sebep: null };
}

/**
 * Haber bazlı puan düzeltmesi
 */
export function adjustScoreWithNews(
  score: number,
  symbol: string,
  impact: NewsImpact | null
): number {
  if (!impact) return score;

  let adjustment = 0;
  
  // Genel piyasa faktörü (max ±5 puan)
  adjustment += Math.round(impact.pileseFaktoru / 2);

  // Hisse bazlı uyarı
  const warning = getStockNewsWarning(symbol, impact);
  if (warning.uyari === 'GİRME') adjustment -= 10;
  else if (warning.uyari === 'DİKKATLİ OL') adjustment -= 3;
  else if (warning.uyari === 'GİR') adjustment += 5;

  return Math.max(0, Math.min(100, score + adjustment));
}
