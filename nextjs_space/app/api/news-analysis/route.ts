export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getNewsImpact } from '@/lib/news-analysis';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { takeRequestSlot } from '@/lib/request-limit';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
    const slot = takeRequestSlot(`news:${userId}`, 10, 60_000);
    if (!slot.allowed) return NextResponse.json({ error: 'Çok fazla istek. Lütfen biraz bekleyin.' },
      { status: 429, headers: { 'Retry-After': String(slot.retryAfter) } });
    const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
    const impact = await getNewsImpact(baseUrl);
    if (!impact) {
      return NextResponse.json({ impact: null, message: 'Haber analizi yapılamadı' });
    }
    return NextResponse.json({ impact });
  } catch (e: any) {
    return NextResponse.json({ impact: null, error: 'Haber analizi şu anda kullanılamıyor.' }, { status: 503 });
  }
}
