import { CommunityMembersPageClient } from './CommunityMembersPageClient';

interface CommunityMembersPageProps {
  params: { id: string };
}

export default function CommunityMembersPage({ params }: CommunityMembersPageProps) {
  const { id } = params;
  return <CommunityMembersPageClient communityId={id} />;
}
