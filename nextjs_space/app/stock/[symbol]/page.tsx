import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import StockDetailClient from './stock-detail-client';

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <StockDetailClient symbol={decodeURIComponent((await params).symbol)} />;
}
