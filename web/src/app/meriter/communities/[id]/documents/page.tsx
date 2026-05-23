import { CommunityDocumentsPageClient } from '@/features/documents/pages/CommunityDocumentsPageClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return { title: 'Documents' };
}

export default async function CommunityDocumentsPage({ params }: PageProps) {
  const { id } = await params;
  return <CommunityDocumentsPageClient communityId={id} />;
}
