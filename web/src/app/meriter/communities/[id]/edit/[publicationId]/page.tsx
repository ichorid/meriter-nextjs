import { EditPublicationPageClient } from './EditPublicationPageClient';

interface EditPublicationPageProps {
  params: Promise<{ id: string; publicationId: string }>;
}

export default async function EditPublicationPage({ params }: EditPublicationPageProps) {
  const { id, publicationId } = await params;
  return <EditPublicationPageClient communityId={id} publicationId={publicationId} />;
}
