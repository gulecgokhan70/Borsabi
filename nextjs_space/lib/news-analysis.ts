import { AIServiceError, getAIConfig, requestAICompletion } from './ai-provider';

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
const CACHE_TTL = 30 * 60 * 1000; // 30 dakika
const MAX_STALE_AGE = 6 * 60 * 60 * 1000;
const FAILURE_COOLDOWN = 60_000;
type AnalysisState = {
  cache: { data: NewsImpact; ts: number } | null;
  pending: Promise<NewsImpact | null> | null;
  nextAttemptAt: number;
};
// The chat and news routes must share both completed and in-flight work.
const shared = globalThis as typeof globalThis & { borsabiNewsAnalysis?: AnalysisState };
const state = shared.borsabiNewsAnalysis ??= { cache: null, pending: null, nextAttemptAt: 0 };

function staleAnalysis() {
  return state.cache && Date.now() - state.cache.ts < MAX_STALE_AGE ? state.cache.data : null;
}

/* ── Haberleri çek ── */
async function fetchNewsForAnalysis(baseUrl: string): Promise<string> {
  try {
    const res = await fetch(`${baseUrl}/api/news?limit=25`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
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
  getAIConfig();

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

  const response = await requestAICompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' }, max_tokens: 3000, temperature: 0.3,
  });

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
  if (state.cache && Date.now() - state.cache.ts < CACHE_TTL) return state.cache.data;
  if (state.pending) return state.pending;
  if (Date.now() < state.nextAttemptAt) return staleAnalysis();

  // Defer execution until pending is set, including synchronous configuration errors.
  state.pending = Promise.resolve().then(async () => {
    try {
      getAIConfig();
      const newsText = await fetchNewsForAnalysis(baseUrl);
      if (!newsText) {
        state.nextAttemptAt = Date.now() + FAILURE_COOLDOWN;
        return staleAnalysis();
      }
      const analysis = await analyzeWithAI(newsText);
      state.cache = { data: analysis, ts: Date.now() };
      state.nextAttemptAt = 0;
      return analysis;
    } catch (error) {
      const retryMs = error instanceof AIServiceError && error.retryAfter
        ? Math.min(86400, error.retryAfter) * 1000 : FAILURE_COOLDOWN;
      state.nextAttemptAt = Date.now() + Math.max(FAILURE_COOLDOWN, retryMs);
      return staleAnalysis();
    }
  }).finally(() => { state.pending = null; });
  return state.pending;
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
