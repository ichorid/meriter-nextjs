import { CommunityContextMeritHistoryClient } from '@/features/merit-transfer/pages/CommunityContextMeritHistoryClient';
import { routes } from '@/lib/constants/routes';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return {
    title: 'Merit history',
  };
}

export default async function CommunityMeritHistoryPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <CommunityContextMeritHistoryClient
      contextCommunityId={id}
      backHref={routes.community(id)}
      titleKey="communityMeritHistoryTitle"
    />
  );
}
