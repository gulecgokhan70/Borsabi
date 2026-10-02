import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CourseDetailClient } from './course-detail-client';

export default async function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <CourseDetailClient courseId={(await params).courseId} />;
}
