import { redirect } from 'next/navigation';
import { routes } from '@/lib/constants/routes';

interface CommunityProjectsPageProps {
  params: Promise<{ id: string }>;
}

export default async function CommunityProjectsPage({ params }: CommunityProjectsPageProps) {
  const { id } = await params;
  redirect(`${routes.community(id)}?feedTab=projects`);
}
