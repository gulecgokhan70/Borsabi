import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SocialClient from './social-client';

export default async function SocialPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <SocialClient />;
}
