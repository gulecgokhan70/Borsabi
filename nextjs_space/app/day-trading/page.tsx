import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DayTradingClient } from './day-trading-client';

export default async function DayTradingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <DayTradingClient />;
}
