import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BeginnerGuide } from '@/components/beginner-guide';
export default async function BeginnerGuidePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  return <BeginnerGuide key={session.user.id} accountId={session.user.id} />;
}
