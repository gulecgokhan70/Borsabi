export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getNewsImpact } from '@/lib/news-analysis';

export async function GET() {
  try {
    const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
    const impact = await getNewsImpact(baseUrl);
    if (!impact) {
      return NextResponse.json({ impact: null, message: 'Haber analizi yapılamadı' });
    }
    return NextResponse.json({ impact });
  } catch (e: any) {
    console.error('News analysis API error:', e);
    return NextResponse.json({ impact: null, error: e.message }, { status: 500 });
  }
}
