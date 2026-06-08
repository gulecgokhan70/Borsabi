import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { TradeLogClient } from './trade-log-client';

export default async function TradeLogPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <TradeLogClient />;
}
