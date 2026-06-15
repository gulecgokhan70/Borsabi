export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

interface NewsItem {
  title: string;
  summary: string;
  source: string;
  url: string;
  date: string;
  category: string;
  sentiment?: string;
  importance?: number;
}

interface MarketAlert {
  id: string;
  title: string;
  summary: string;
  direction: 'pozitif' | 'negatif' | 'nötr';
  impact: 'yüksek' | 'orta' | 'düşük';
  category: 'gece' | 'gün';
  source: string;
  affectedSectors: string[];
  affectedSymbols: string[];
  actionSuggestion: string;
}

/* ── Sektör tespiti ── */
const SECTOR_KEYWORDS: [RegExp, string][] = [
  [/banka|finans|kredi|faiz|tcmb|merkez bankas/i, 'Bankacılık'],
  [/enerji|petrol|doğalgaz|elektrik|güneş|rüzgar/i, 'Enerji'],
  [/otomotiv|araç|otomobil|togg/i, 'Otomotiv'],
  [/inşaat|konut|gayrimenkul|emlak/i, 'İnşaat'],
  [/teknoloji|yazılım|dijital|siber/i, 'Teknoloji'],
  [/sağlık|ilaç|hastane|tıp/i, 'Sağlık'],
  [/gıda|tarım|hayvancılık/i, 'Gıda'],
  [/madencilik|çelik|demir|altın|metal/i, 'Madencilik'],
  [/savunma|askeri|aselsan|roketsan/i, 'Savunma'],
  [/perakende|mağaza|tüketici/i, 'Perakende'],
  [/telekomünikasyon|telekom|turkcell|avea/i, 'Telekom'],
  [/turizm|otel|havayolu|uçuş/i, 'Turizm'],
  [/lojistik|nakliye|denizcilik/i, 'Lojistik'],
];

/* ── Hisse tespiti ── */
const BIST_SYMBOLS = [
  'THYAO', 'GARAN', 'AKBNK', 'YKBNK', 'EREGL', 'ASELS', 'KCHOL', 'BIMAS', 'SAHOL',
  'TUPRS', 'SISE', 'TAVHL', 'PETKM', 'TCELL', 'ENKAI', 'HEKTS', 'FROTO', 'TOASO',
  'KOZAL', 'GUBRF', 'TTKOM', 'VESTL', 'MGROS', 'DOHOL', 'ARCLK', 'TKFEN', 'PGSUS',
  'EKGYO', 'GESAN', 'KRDMD', 'SASA', 'OYAKC', 'KONTR', 'AEFES', 'BRYAT', 'EUPWR',
  'ODAS', 'BTCTURK', 'MPARK', 'CIMSA',
];

/* ── Aksiyon önerisi oluştur ── */
function generateAction(item: NewsItem): string {
  const text = (item.title + ' ' + item.summary).toLowerCase();

  if (/faiz.*art|faiz.*yükselt/i.test(text))
    return 'Faiz artışı banka hisselerini olumlu etkileyebilir. Banka sektörünü takip edin.';
  if (/faiz.*indir|faiz.*düşür/i.test(text))
    return 'Faiz indirimi büyüme hisselerini destekleyebilir. İnşaat ve perakende sektörüne bakın.';
  if (/enflasyon.*yüksel|tüfe.*art/i.test(text))
    return 'Yükselen enflasyon portföyünüzü etkileyebilir. Reel sektör hisselerine dikkat edin.';
  if (/dolar.*yüksel|dolar.*art|kur.*sert/i.test(text))
    return 'Dolar yükselişi ihracatçıları olumlu, ithalatçıları olumsuz etkiler. Portföyünüzü gözden geçirin.';
  if (/bist.*düş|borsa.*düş|endeks.*geril/i.test(text))
    return 'Piyasa düşüşünde stop-loss seviyelerinizi kontrol edin. Panik satış yapmaktan kaçının.';
  if (/bist.*yüksel|borsa.*yüksel|ralli/i.test(text))
    return 'Yükseliş trendinde kar realizasyonu noktalarını belirleyin.';
  if (/temettü|kar dağıt/i.test(text))
    return 'Temettü haberi hisse fiyatını etkileyebilir. Dağıtım tarihini takip edin.';
  if (/bitcoin.*yüksel|btc.*art/i.test(text))
    return 'Kripto yükselişinde aşırı risk almaktan kaçının. Portföy dengesini koruyun.';
  if (/bitcoin.*düş|kripto.*düş/i.test(text))
    return 'Kripto düşüşünde DCA stratejisi değerlendirebilirsiniz.';

  if (item.sentiment === 'positive') return 'Olumlu gelişmeleri takip edin, fırsatları değerlendirin.';
  if (item.sentiment === 'negative') return 'Risk yönetimi uygulayın, stop-loss seviyelerinizi kontrol edin.';
  return 'Piyasa gelişmelerini takip etmeye devam edin.';
}

/* ── Haber → Alert dönüşümü ── */
function newsToAlert(item: NewsItem, idx: number): MarketAlert {
  const text = (item.title + ' ' + item.summary).toLowerCase();

  // Direction
  let direction: MarketAlert['direction'] = 'nötr';
  if (item.sentiment === 'positive') direction = 'pozitif';
  else if (item.sentiment === 'negative') direction = 'negatif';

  // Impact
  const importance = item.importance ?? 0;
  let impact: MarketAlert['impact'] = 'düşük';
  if (importance >= 7) impact = 'yüksek';
  else if (importance >= 4) impact = 'orta';

  // Category (gece vs gün)
  const hour = new Date(item.date).getHours();
  const category: MarketAlert['category'] = (hour >= 18 || hour < 9) ? 'gece' : 'gün';

  // Affected sectors
  const sectors: string[] = [];
  for (const [regex, sector] of SECTOR_KEYWORDS) {
    if (regex.test(text) && !sectors.includes(sector)) sectors.push(sector);
  }

  // Affected symbols
  const symbols: string[] = [];
  for (const sym of BIST_SYMBOLS) {
    if (text.includes(sym.toLowerCase())) symbols.push(sym);
  }

  return {
    id: `alert-${idx}-${Date.now()}`,
    title: item.title,
    summary: item.summary,
    direction,
    impact,
    category,
    source: `${item.source} • ${new Date(item.date).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}`,
    affectedSectors: sectors.slice(0, 3),
    affectedSymbols: symbols.slice(0, 5),
    actionSuggestion: generateAction(item),
  };
}

export async function GET(req: Request) {
  try {
    const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
    // Fetch news from our own news API
    const newsRes = await fetch(`${baseUrl}/api/news?limit=30`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!newsRes.ok) {
      return NextResponse.json({ alerts: [] });
    }

    const newsData = await newsRes.json();
    const newsItems: NewsItem[] = newsData?.news ?? [];

    // Filter: importance >= 3 for alerts (meaningful news only)
    const significant = newsItems.filter(n => (n.importance ?? 0) >= 3);

    // Convert to alerts, max 10
    const alerts: MarketAlert[] = significant.slice(0, 10).map((n, i) => newsToAlert(n, i));

    // Sort by impact (yüksek first)
    const impactOrder = { 'yüksek': 0, 'orta': 1, 'düşük': 2 };
    alerts.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

    return NextResponse.json(
      { alerts, updatedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300' } }
    );
  } catch (e: any) {
    console.error('Market alerts API error:', e);
    return NextResponse.json({ alerts: [], error: e.message }, { status: 500 });
  }
}
