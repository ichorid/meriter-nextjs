import { CommunityDocumentDetailPageClient } from '@/features/documents/pages/CommunityDocumentDetailPageClient';

interface PageProps {
  params: Promise<{ id: string; documentId: string }>;
}

export async function generateMetadata() {
  return { title: 'Document' };
}

export default async function CommunityDocumentDetailPage({ params }: PageProps) {
  const { id, documentId } = await params;
  return <CommunityDocumentDetailPageClient communityId={id} documentId={documentId} />;
}
