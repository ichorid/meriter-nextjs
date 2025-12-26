import { CreatePublicationPageClient } from './CreatePublicationPageClient';

interface CreatePublicationPageProps {
  params: { id: string };
}

export default function CreatePublicationPage({ params }: CreatePublicationPageProps) {
  const { id } = params;
  return <CreatePublicationPageClient communityId={id} />;
}


