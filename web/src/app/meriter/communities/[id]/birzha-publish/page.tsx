import { BirzhaPublishPageClient } from './BirzhaPublishPageClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return { title: 'Publish to Birzha' };
}

export default async function CommunityBirzhaPublishPage({ params }: PageProps) {
  const { id } = await params;
  return <BirzhaPublishPageClient sourceCommunityId={id} />;
}
