import { CommunityPageClient } from './CommunityPageClient';

interface CommunityPageProps {
  params: { id: string };
}

// Required for static export with dynamic routes
// Return a placeholder to satisfy static export requirements
// Actual routing will be handled client-side
export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  return [{ id: '_' }];
}

export default function CommunityPage({ params }: CommunityPageProps) {
  const { id } = params;
  // 404 handling is done in CommunityPageClient component
  // since we need to check the API response to determine if community exists
  return <CommunityPageClient communityId={id} />;
}
