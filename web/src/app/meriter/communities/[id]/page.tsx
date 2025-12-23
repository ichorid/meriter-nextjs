import { CommunityPageClient } from './CommunityPageClient';

interface CommunityPageProps {
  params: Promise<{ id: string }>;
}

// Required for static export with dynamic routes
export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  // Return empty array - dynamic routes will be handled client-side
  return [];
}

export default async function CommunityPage({ params }: CommunityPageProps) {
  const { id } = await params;
  return <CommunityPageClient communityId={id} />;
}
