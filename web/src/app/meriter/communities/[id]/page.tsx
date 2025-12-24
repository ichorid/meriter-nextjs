import { CommunityPageClient } from './CommunityPageClient';

interface CommunityPageProps {
  params: { id: string };
}

// Required for static export with dynamic routes
export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  // Return empty array - dynamic routes will be handled client-side
  return [];
}

export default function CommunityPage({ params }: CommunityPageProps) {
  const { id } = params;
  return <CommunityPageClient communityId={id} />;
}
