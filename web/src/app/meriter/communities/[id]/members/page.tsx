import { CommunityMembersPageClient } from './CommunityMembersPageClient';

interface CommunityMembersPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string; context?: string }>;
}

export async function generateMetadata() {
  return {
    title: 'Members',
  };
}

export default async function CommunityMembersPage({ params, searchParams }: CommunityMembersPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  return (
    <CommunityMembersPageClient
      communityId={id}
      returnTo={typeof sp.returnTo === 'string' ? sp.returnTo : undefined}
      membersContext={sp.context === 'project' ? 'project' : undefined}
    />
  );
}
