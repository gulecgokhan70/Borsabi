import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SwingTradingClient } from './swing-trading-client';

export default async function SwingTradingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <SwingTradingClient />;
}
