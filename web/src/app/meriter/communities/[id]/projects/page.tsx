import { CommunityProjectsPageClient } from './CommunityProjectsPageClient';

interface CommunityProjectsPageProps {
  params: Promise<{ id: string }>;
}

export default async function CommunityProjectsPage({ params }: CommunityProjectsPageProps) {
  const { id } = await params;
  return <CommunityProjectsPageClient communityId={id} />;
}
