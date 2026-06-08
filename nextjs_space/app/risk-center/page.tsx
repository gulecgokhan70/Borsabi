import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { RiskCenterClient } from './risk-center-client';

export default async function RiskCenterPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <RiskCenterClient />;
}
