import { CommunityRulesPageClient } from './CommunityRulesPageClient';

interface CommunityRulesPageProps {
  params: Promise<{ id: string }>;
}

// Required for static export with dynamic routes
export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  // Return empty array - dynamic routes will be handled client-side
  return [];
}

export default async function CommunityRulesPage({ params }: CommunityRulesPageProps) {
  const { id } = await params;
  return <CommunityRulesPageClient communityId={id} />;
}
