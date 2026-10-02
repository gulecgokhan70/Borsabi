import { getAllNews, newsSourceStatus } from '@/lib/news-feed';
import { buildMarketAlerts } from '@/lib/market-alerts';
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const news = await getAllNews();
    return NextResponse.json(buildMarketAlerts(news, newsSourceStatus()), { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch {
    return NextResponse.json({ error: 'Haber kaynaklarına şu anda ulaşılamıyor. Tekrar deneyin.' }, { status: 503 });
  }
}
