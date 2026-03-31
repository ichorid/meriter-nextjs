import { BirzhaPublishPageClient } from './BirzhaPublishPageClient';
import { metadataTitle } from '@/lib/i18n/metadata-title';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return metadataTitle('birzhaSource.publishTitle');
}

export default async function CommunityBirzhaPublishPage({ params }: PageProps) {
  const { id } = await params;
  return <BirzhaPublishPageClient sourceCommunityId={id} />;
}
