import { CommunityMembersPageClient } from './CommunityMembersPageClient';

interface CommunityMembersPageProps {
  params: Promise<{ id: string }>;
}

export default async function CommunityMembersPage({ params }: CommunityMembersPageProps) {
  const { id } = await params;
  return <CommunityMembersPageClient communityId={id} />;
}
