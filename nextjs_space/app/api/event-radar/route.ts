export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { takeRequestSlot } from '@/lib/request-limit';
import { getAllNews, newsSourceStatus } from '@/lib/news-feed';
import { buildEventRadar } from '@/lib/event-radar';
export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401, headers });
    const slot = takeRequestSlot(`event-radar:${userId}`, 10, 60_000);
    if (!slot.allowed) return NextResponse.json({ error: 'Lütfen biraz bekleyip yeniden deneyin.' }, { status: 429, headers: { ...headers, 'Retry-After': String(slot.retryAfter) } });
    const news = await getAllNews();
    return NextResponse.json({ ...buildEventRadar(news), sources: newsSourceStatus() }, { headers });
  } catch {
    return NextResponse.json({ error: 'Gelişmeler şu anda değerlendirilemiyor.' }, { status: 503, headers });
  }
}
