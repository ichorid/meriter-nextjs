import { CommunityMembersPageClient } from './CommunityMembersPageClient';

interface CommunityMembersPageProps {
  params: Promise<{ id: string }>;
}

// Required for static export with dynamic routes
export async function generateStaticParams() {
  // Return empty array - dynamic routes will be handled client-side
  return [];
}

export default async function CommunityMembersPage({ params }: CommunityMembersPageProps) {
  const { id } = await params;
  return <CommunityMembersPageClient communityId={id} />;
}
