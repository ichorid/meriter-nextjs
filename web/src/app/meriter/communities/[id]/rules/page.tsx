import { CommunityRulesPageClient } from './CommunityRulesPageClient';

interface CommunityRulesPageProps {
  params: { id: string };
}

// Required for static export with dynamic routes
export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  // Return empty array - dynamic routes will be handled client-side
  return [];
}

export default function CommunityRulesPage({ params }: CommunityRulesPageProps) {
  const { id } = params;
  return <CommunityRulesPageClient communityId={id} />;
}
