export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

interface NewsItem {
  title: string;
  summary: string;
  source: string;
  url: string;
  date: string;
  category: 'genel' | 'bist' | 'kripto' | 'kap' | 'dunya';
  symbol?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  importance?: number; // 0-10 scale, 7+ = breaking worthy
}

/* ── Önem skoru hesapla ── */
const BREAKING_KEYWORDS: [RegExp, number][] = [
  // Merkez bankası / faiz
  [/tcmb|merkez bankas[ıi]/i, 4],
  [/faiz.*karar|faiz.*art[ıi]|faiz.*indir|faiz.*de[ğg]i[şs]/i, 5],
  [/politika faiz/i, 5],
  // Makroekonomi kritik
  [/enflasyon.*a[çc][ıi]klan|t[üu]fe|[üu]fe.*a[çc][ıi]klan/i, 4],
  [/b[üu]y[üu]me.*veri|gsyh|cari a[çc][ıi]k/i, 3],
  [/i[şs]sizlik.*veri/i, 3],
  // Döviz / altın sert hareket
  [/dolar.*rekor|dolar.*sert|dolar.*[ff][ıi]rla|dolar.*[çc][öo]k/i, 5],
  [/euro.*rekor|euro.*sert/i, 4],
  [/alt[ıi]n.*rekor|alt[ıi]n.*sert/i, 4],
  // BIST kritik
  [/bist.*100.*rekor|xu100.*rekor|borsa.*rekor/i, 5],
  [/bist.*sert.*d[üu][şs]|borsa.*[çc][öo]k|bist.*[çc]ak[ıi]l/i, 5],
  [/bist.*ralli|borsa.*ralli/i, 4],
  [/devre kesici|tavan|taban.*kilid/i, 4],
  // Kripto kritik
  [/bitcoin.*rekor|btc.*rekor/i, 4],
  [/bitcoin.*sert|bitcoin.*[çc][öo]k|bitcoin.*[çc]ak[ıi]l/i, 4],
  [/ethereum.*rekor|eth.*rekor/i, 3],
  // Genel piyasa şok
  [/kriz|[çc][öo]k[üu][şs]|panik|sert d[üu][şs][üu][şs]|flash crash/i, 5],
  [/resesyon|durgunluk/i, 4],
  [/sava[şs]|ambargo|yapt[ıi]r[ıi]m/i, 3],
  // Şirket haberleri önemli
  [/kar da[ğg][ıi]t|temett[üu]/i, 3],
  [/birle[şs]me|devralma|sat[ıi]n al[ıi]m/i, 3],
  [/halka arz/i, 3],
  [/spk|sermaye piyasas[ıi] kurulu/i, 3],
  // Genel önem artırıcılar
  [/son dakika|breaking|flash/i, 3],
  [/rekor/i, 2],
  [/sert|a[şs][ıi]r[ıi]|tarihi/i, 2],
];

function calculateImportance(item: NewsItem): number {
  let score = 0;
  const text = (item.title + ' ' + item.summary).toLowerCase();

  for (const [regex, weight] of BREAKING_KEYWORDS) {
    if (regex.test(text)) score += weight;
  }

  // Sentiment güçlendirici — pozitif/negatif haberler daha önemli
  if (item.sentiment === 'positive' || item.sentiment === 'negative') score += 1;

  // KAP bildirimleri önemli şirket haberleri içerebilir
  if (item.category === 'kap') score += 2;

  // Ekonomi kategorisi bonus
  if (item.category === 'bist' || item.category === 'dunya') score += 1;

  // Taze haber bonusu (son 1 saat içinde)
  const ageMs = Date.now() - new Date(item.date).getTime();
  if (ageMs < 60 * 60 * 1000) score += 2;
  else if (ageMs < 3 * 60 * 60 * 1000) score += 1;

  return Math.min(score, 10);
}

/* ── In-memory cache ── */
let newsCache: { data: NewsItem[]; ts: number } | null = null;
const NEWS_TTL = 10 * 60 * 1000; // 10 min

/* ── RSS XML parser (simple) ── */
function parseRssItems(xml: string): { title: string; link: string; description: string; pubDate: string }[] {
  const items: any[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[0];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return (m?.[1] || m?.[2] || '').trim();
    };
    items.push({ title: get('title'), link: get('link'), description: get('description').replace(/<[^>]+>/g, '').substring(0, 200), pubDate: get('pubDate') });
  }
  return items;
}

/* ── Fetch RSS feed safely ── */
async function fetchRss(url: string, timeout = 5000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/* ── KAP bildirim sayfasından çek ── */
async function fetchKapNews(): Promise<NewsItem[]> {
  try {
    const xml = await fetchRss('https://www.kap.org.tr/tr/rss/bildiriler');
    const items = parseRssItems(xml).slice(0, 15);
    return items.map(i => ({
      title: i.title,
      summary: i.description || i.title,
      source: 'KAP',
      url: i.link || 'https://www.kap.org.tr',
      date: i.pubDate ? new Date(i.pubDate).toISOString() : new Date().toISOString(),
      category: 'kap' as const,
      sentiment: 'neutral' as const,
    }));
  } catch (e) {
    // KAP RSS may be unavailable - silent fallback
    return [];
  }
}

/* ── Bloomberg HT haberler ── */
async function fetchBloombergHT(): Promise<NewsItem[]> {
  try {
    const xml = await fetchRss('https://www.bloomberght.com/rss');
    const items = parseRssItems(xml).slice(0, 12);
    return items.map(i => {
      const titleLower = i.title.toLowerCase();
      let category: NewsItem['category'] = 'genel';
      let sentiment: NewsItem['sentiment'] = 'neutral';
      if (titleLower.includes('bist') || titleLower.includes('borsa') || titleLower.includes('endeks')) category = 'bist';
      else if (titleLower.includes('bitcoin') || titleLower.includes('kripto') || titleLower.includes('ethereum')) category = 'kripto';
      else if (titleLower.includes('dolar') || titleLower.includes('euro') || titleLower.includes('faiz') || titleLower.includes('enflasyon')) category = 'dunya';
      if (titleLower.includes('yüksel') || titleLower.includes('artı') || titleLower.includes('rekor') || titleLower.includes('ralli')) sentiment = 'positive';
      else if (titleLower.includes('düşü') || titleLower.includes('kayıp') || titleLower.includes('geril') || titleLower.includes('çök')) sentiment = 'negative';
      return {
        title: i.title,
        summary: i.description || i.title,
        source: 'Bloomberg HT',
        url: i.link || 'https://www.bloomberght.com',
        date: i.pubDate ? new Date(i.pubDate).toISOString() : new Date().toISOString(),
        category,
        sentiment,
      };
    });
  } catch (e) {
    console.error('BloombergHT RSS error:', e);
    return [];
  }
}

/* ── Dünya gazetesi ── */
async function fetchDunya(): Promise<NewsItem[]> {
  try {
    const xml = await fetchRss('https://www.dunya.com/rss');
    const items = parseRssItems(xml).slice(0, 8);
    return items.map(i => {
      const titleLower = i.title.toLowerCase();
      let category: NewsItem['category'] = 'genel';
      if (titleLower.includes('bist') || titleLower.includes('borsa')) category = 'bist';
      else if (titleLower.includes('bitcoin') || titleLower.includes('kripto')) category = 'kripto';
      return {
        title: i.title,
        summary: i.description || i.title,
        source: 'Dünya',
        url: i.link || 'https://www.dunya.com',
        date: i.pubDate ? new Date(i.pubDate).toISOString() : new Date().toISOString(),
        category,
        sentiment: 'neutral' as const,
      };
    });
  } catch (e) {
    console.error('Dunya RSS error:', e);
    return [];
  }
}

/* ── Tüm haberleri birleştir ── */
async function getAllNews(): Promise<NewsItem[]> {
  if (newsCache && Date.now() - newsCache.ts < NEWS_TTL) return newsCache.data;

  const [bloomberg, dunya, kap] = await Promise.allSettled([
    fetchBloombergHT(),
    fetchDunya(),
    fetchKapNews(),
  ]);

  const all: NewsItem[] = [
    ...(bloomberg.status === 'fulfilled' ? bloomberg.value : []),
    ...(dunya.status === 'fulfilled' ? dunya.value : []),
    ...(kap.status === 'fulfilled' ? kap.value : []),
  ];

  // Sort by date desc
  all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Deduplicate by title similarity
  const seen = new Set<string>();
  const deduped = all.filter(n => {
    const key = n.title.toLowerCase().substring(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Calculate importance scores
  for (const item of deduped) {
    item.importance = calculateImportance(item);
  }

  newsCache = { data: deduped, ts: Date.now() };
  return deduped;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category'); // genel, bist, kripto, kap, dunya
    const symbol = searchParams.get('symbol');
    const limit = parseInt(searchParams.get('limit') || '20');
    const breaking = searchParams.get('breaking') === 'true'; // sadece önemli haberler
    const minImportance = parseInt(searchParams.get('minImportance') || '0');

    let news = await getAllNews();

    if (category) {
      news = news.filter(n => n.category === category);
    }

    if (symbol) {
      const sym = symbol.replace('.IS', '').replace('-USD', '').toLowerCase();
      // Filter news that mention the symbol in title or summary
      const symbolNews = news.filter(n => {
        const text = (n.title + ' ' + n.summary).toLowerCase();
        return text.includes(sym);
      });
      // If symbol-specific news found, use them; otherwise return general news for the category
      if (symbolNews.length > 0) {
        news = symbolNews;
      } else {
        // Return BIST news for .IS symbols, kripto news for -USD symbols
        const cat = symbol.endsWith('.IS') ? 'bist' : symbol.endsWith('-USD') ? 'kripto' : 'genel';
        news = news.filter(n => n.category === cat || n.category === 'kap');
      }
    }

    // Breaking filter: sadece önem skoru 5+ olan haberleri dön
    if (breaking) {
      news = news.filter(n => (n.importance ?? 0) >= 5);
    } else if (minImportance > 0) {
      news = news.filter(n => (n.importance ?? 0) >= minImportance);
    }

    return NextResponse.json({
      news: news.slice(0, limit),
      updatedAt: newsCache?.ts ? new Date(newsCache.ts).toISOString() : new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300' },
    });
  } catch (e: any) {
    console.error('News API error:', e);
    return NextResponse.json({ news: [], error: e.message }, { status: 500 });
  }
}
