import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CourseDetailClient } from './course-detail-client';

export default async function CourseDetailPage({ params }: { params: { courseId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <CourseDetailClient courseId={params.courseId} />;
}
