import { EditPublicationPageClient } from './EditPublicationPageClient';

interface EditPublicationPageProps {
  params: { id: string; publicationId: string };
}

export default function EditPublicationPage({ params }: EditPublicationPageProps) {
  const { id, publicationId } = params;
  return <EditPublicationPageClient communityId={id} publicationId={publicationId} />;
}
