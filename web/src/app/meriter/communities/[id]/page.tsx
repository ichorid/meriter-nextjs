import { CommunityPageClient } from './CommunityPageClient';

interface CommunityPageProps {
  params: Promise<{ id: string }>;
}

export default async function CommunityPage({ params }: CommunityPageProps) {
  const { id } = await params;
  // 404 handling is done in CommunityPageClient component
  // since we need to check the API response to determine if community exists
  return <CommunityPageClient communityId={id} />;
}
