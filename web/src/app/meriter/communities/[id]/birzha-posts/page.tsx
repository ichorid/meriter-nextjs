import { CommunityBirzhaPostsPageClient } from './CommunityBirzhaPostsPageClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return { title: 'Birzha posts' };
}

export default async function CommunityBirzhaPostsPage({ params }: PageProps) {
  const { id } = await params;
  return <CommunityBirzhaPostsPageClient communityId={id} />;
}
