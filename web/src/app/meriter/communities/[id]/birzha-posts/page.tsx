import { redirect } from 'next/navigation';
import { routes } from '@/lib/constants/routes';
import { metadataTitle } from '@/lib/i18n/metadata-title';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return metadataTitle('metadata.birzhaPosts');
}

export default async function CommunityBirzhaPostsPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`${routes.community(id)}?feedTab=birzha`);
}
