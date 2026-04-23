import { redirect } from 'next/navigation';
import { routes } from '@/lib/constants/routes';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return {
    title: 'Merit history',
  };
}

export default async function CommunityMeritTransfersPage({ params }: PageProps) {
  const { id } = await params;
  redirect(routes.communityMeritHistory(id));
}
