import { CommunityBirzhaPostsPageClient } from './CommunityBirzhaPostsPageClient';
import { metadataTitle } from '@/lib/i18n/metadata-title';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return metadataTitle('metadata.birzhaPosts');
}

export default async function CommunityBirzhaPostsPage({ params }: PageProps) {
  const { id } = await params;
  return <CommunityBirzhaPostsPageClient communityId={id} />;
}
