import { CommunityRulesPageClient } from './CommunityRulesPageClient';

interface CommunityRulesPageProps {
  params: { id: string };
}

export default function CommunityRulesPage({ params }: CommunityRulesPageProps) {
  const { id } = params;
  return <CommunityRulesPageClient communityId={id} />;
}
