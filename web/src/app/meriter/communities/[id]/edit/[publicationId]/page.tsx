import { EditPublicationPageClient } from './EditPublicationPageClient';

interface EditPublicationPageProps {
  params: { id: string; publicationId: string };
}

// Required for static export with dynamic routes
// Return a placeholder to satisfy static export requirements
// Actual routing will be handled client-side
export async function generateStaticParams(): Promise<Array<{ id: string; publicationId: string }>> {
  return [{ id: '_', publicationId: '_' }];
}

export default function EditPublicationPage({ params }: EditPublicationPageProps) {
  const { id, publicationId } = params;
  return <EditPublicationPageClient communityId={id} publicationId={publicationId} />;
}
