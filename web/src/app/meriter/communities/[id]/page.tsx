import { CommunityPageClient } from './CommunityPageClient';

interface CommunityPageProps {
  params: { id: string };
}

export default function CommunityPage({ params }: CommunityPageProps) {
  const { id } = params;
  // 404 handling is done in CommunityPageClient component
  // since we need to check the API response to determine if community exists
  return <CommunityPageClient communityId={id} />;
}
