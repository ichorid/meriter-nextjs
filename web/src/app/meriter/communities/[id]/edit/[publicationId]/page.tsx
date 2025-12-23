import { EditPublicationPageClient } from './EditPublicationPageClient';

interface EditPublicationPageProps {
  params: Promise<{ id: string; publicationId: string }>;
}

// Required for static export with dynamic routes
export async function generateStaticParams(): Promise<Array<{ id: string; publicationId: string }>> {
  // Return empty array - dynamic routes will be handled client-side
  return [];
}

export default async function EditPublicationPage({ params }: EditPublicationPageProps) {
  const { id, publicationId } = await params;
  return <EditPublicationPageClient communityId={id} publicationId={publicationId} />;
}
