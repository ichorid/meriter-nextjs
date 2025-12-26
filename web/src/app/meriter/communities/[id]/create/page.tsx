import { CreatePublicationPageClient } from './CreatePublicationPageClient';

interface CreatePublicationPageProps {
  params: Promise<{ id: string }>;
}

export default async function CreatePublicationPage({ params }: CreatePublicationPageProps) {
  const { id } = await params;
  return <CreatePublicationPageClient communityId={id} />;
}


