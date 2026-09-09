export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getMarketQuotes } from '@/lib/market-quotes';

export async function GET(request: NextRequest) {
  try {
    const symbols = new URL(request.url).searchParams.get('symbols');
    const list = symbols?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
    if (!list.length || list.length > 100 || list.some(s => !/^[A-Za-z0-9.^=-]{1,32}$/.test(s))) {
      return NextResponse.json({ error: '1 ile 100 arasında geçerli sembol gerekli' }, { status: 400 });
    }
    const results = await getMarketQuotes(list);
    return NextResponse.json({ data: results, marketOpen: results.some(r => r.marketOpen) }, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('Market API error:', error);
    return NextResponse.json({ error: 'Piyasa verileri alınamadı' }, { status: 500 });
  }
}
