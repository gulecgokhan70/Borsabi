import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BacktestClient } from './backtest-client';

export default async function BacktestPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <BacktestClient />;
}
