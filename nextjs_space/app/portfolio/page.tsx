import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PortfolioClient } from './portfolio-client';

export default async function PortfolioPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <PortfolioClient />;
}
