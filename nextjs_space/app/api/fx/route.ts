export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUsdTryRate } from '@/lib/fx';
import { CurrencyError } from '@/lib/currency';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: 'Oturum gerekli' }, { status: 401 });
  try {
    const fx = await getUsdTryRate();
    return Response.json({ pair: 'USD/TRY', ...fx }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof CurrencyError ? error.message : 'Kur alınamadı.' }, { status: 503 });
  }
}
