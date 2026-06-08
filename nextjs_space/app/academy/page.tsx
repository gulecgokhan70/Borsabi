import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AcademyClient } from './academy-client';

export default async function AcademyPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <AcademyClient />;
}
