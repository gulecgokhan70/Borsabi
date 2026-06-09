export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { yf } from '@/lib/yahoo-finance';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols');
    
    if (!symbols) {
      return NextResponse.json({ error: 'symbols parameter required' }, { status: 400 });
    }

    const symbolList = symbols.split(',').map((s: string) => s.trim());
    
    const quotes = await Promise.allSettled(
      symbolList.map(async (sym: string) => {
        try {
          const q: any = await yf.quote(sym);
          // Borsa kapalıyken regularMarketPrice sıfır döner, fallback kullan
          const rawPrice = q?.regularMarketPrice ?? 0;
          const price = rawPrice > 0 ? rawPrice : (q?.regularMarketPreviousClose ?? 0);
          return {
            symbol: sym,
            name: q?.shortName ?? q?.longName ?? sym,
            price,
            change: q?.regularMarketChange ?? 0,
            changePercent: q?.regularMarketChangePercent ?? 0,
            volume: q?.regularMarketVolume ?? 0,
            high: q?.regularMarketDayHigh ?? 0,
            low: q?.regularMarketDayLow ?? 0,
            open: q?.regularMarketOpen ?? 0,
            prevClose: q?.regularMarketPreviousClose ?? 0,
            marketCap: q?.marketCap ?? 0,
            currency: q?.currency ?? 'TRY',
            marketOpen: rawPrice > 0,
          };
        } catch (e: any) {
          console.error(`Quote error for ${sym}:`, e?.message);
          return { symbol: sym, name: sym, price: 0, change: 0, changePercent: 0, volume: 0, high: 0, low: 0, open: 0, prevClose: 0, marketCap: 0, currency: 'TRY', error: true };
        }
      })
    );

    const results = quotes.map((r: any) => r?.status === 'fulfilled' ? r.value : { symbol: 'N/A', price: 0, error: true });
    const anyMarketOpen = results.some((r: any) => r.marketOpen === true);
    return NextResponse.json({ data: results, marketOpen: anyMarketOpen });
  } catch (error: any) {
    console.error('Market API error:', error);
    return NextResponse.json({ error: 'Piyasa verileri alınamadı' }, { status: 500 });
  }
}
