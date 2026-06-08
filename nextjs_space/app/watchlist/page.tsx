import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { WatchlistClient } from './watchlist-client';

export default async function WatchlistPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <WatchlistClient />;
}
