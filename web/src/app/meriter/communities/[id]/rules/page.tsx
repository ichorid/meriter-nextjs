import { CommunityRulesPageClient } from './CommunityRulesPageClient';

interface CommunityRulesPageProps {
  params: Promise<{ id: string }>;
}

export default async function CommunityRulesPage({ params }: CommunityRulesPageProps) {
  const { id } = await params;
  return <CommunityRulesPageClient communityId={id} />;
}
