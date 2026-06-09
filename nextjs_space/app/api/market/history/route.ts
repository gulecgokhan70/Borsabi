export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { yf } from '@/lib/yahoo-finance';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const period = searchParams.get('period') ?? '1mo';
    const interval = searchParams.get('interval') ?? '1d';
    
    if (!symbol) {
      return NextResponse.json({ error: 'symbol parameter required' }, { status: 400 });
    }

    const endDate = new Date();
    let startDate = new Date();
    switch (period) {
      case '1d': startDate.setDate(endDate.getDate() - 1); break;
      case '5d': startDate.setDate(endDate.getDate() - 5); break;
      case '1w': startDate.setDate(endDate.getDate() - 7); break;
      case '1mo': startDate.setMonth(endDate.getMonth() - 1); break;
      case '3mo': startDate.setMonth(endDate.getMonth() - 3); break;
      case '6mo': startDate.setMonth(endDate.getMonth() - 6); break;
      case '1y': startDate.setFullYear(endDate.getFullYear() - 1); break;
      default: startDate.setMonth(endDate.getMonth() - 1);
    }

    const result: any = await yf.chart(symbol, {
      period1: startDate,
      period2: endDate,
      interval: interval as any,
    });

    const quotes = (result?.quotes ?? []).map((q: any) => ({
      date: q?.date?.toISOString?.() ?? '',
      open: q?.open ?? 0,
      high: q?.high ?? 0,
      low: q?.low ?? 0,
      close: q?.close ?? 0,
      volume: q?.volume ?? 0,
    })).filter((q: any) => q?.close > 0);

    return NextResponse.json({ data: quotes, meta: result?.meta ?? {} });
  } catch (error: any) {
    console.error('History API error:', error);
    return NextResponse.json({ error: 'Geçmiş verileri alınamadı' }, { status: 500 });
  }
}
