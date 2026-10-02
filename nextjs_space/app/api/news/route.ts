export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAllNews, newsUpdatedAt } from '@/lib/news-feed';

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
      updatedAt: newsUpdatedAt(),
    }, {
      headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300' },
    });
  } catch (e: any) {
    console.error('News API error:', e);
    return NextResponse.json({ news: [], error: e.message }, { status: 500 });
  }
}
