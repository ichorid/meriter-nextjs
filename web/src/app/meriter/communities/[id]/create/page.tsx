import { CreatePublicationPageClient } from './CreatePublicationPageClient';

interface CreatePublicationPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return {
    title: 'Create Post',
  };
}

export default async function CreatePublicationPage({ params }: CreatePublicationPageProps) {
  const { id } = await params;
  return <CreatePublicationPageClient communityId={id} />;
}


