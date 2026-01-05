import { CommunityMembersPageClient } from './CommunityMembersPageClient';

interface CommunityMembersPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return {
    title: 'Members',
  };
}

export default async function CommunityMembersPage({ params }: CommunityMembersPageProps) {
  const { id } = await params;
  return <CommunityMembersPageClient communityId={id} />;
}
