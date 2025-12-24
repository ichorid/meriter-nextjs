import { CommunityRulesPageClient } from './CommunityRulesPageClient';

interface CommunityRulesPageProps {
  params: { id: string };
}

// Required for static export with dynamic routes
// Return a placeholder to satisfy static export requirements
// Actual routing will be handled client-side
export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  return [{ id: '_' }];
}

export default function CommunityRulesPage({ params }: CommunityRulesPageProps) {
  const { id } = params;
  return <CommunityRulesPageClient communityId={id} />;
}
