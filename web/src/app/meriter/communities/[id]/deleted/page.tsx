import { CommunityDeletedPageClient } from './CommunityDeletedPageClient';

interface CommunityDeletedPageProps {
  params: Promise<{ id: string }>;
}

export default async function CommunityDeletedPage({ params }: CommunityDeletedPageProps) {
  const { id } = await params;
  return <CommunityDeletedPageClient communityId={id} />;
}

