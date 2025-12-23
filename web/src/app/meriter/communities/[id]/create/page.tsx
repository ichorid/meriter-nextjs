import { CreatePublicationPageClient } from './CreatePublicationPageClient';

interface CreatePublicationPageProps {
  params: Promise<{ id: string }>;
}

// Required for static export with dynamic routes
export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  // Return empty array - dynamic routes will be handled client-side
  return [];
}

export default async function CreatePublicationPage({ params }: CreatePublicationPageProps) {
  const { id } = await params;
  return <CreatePublicationPageClient communityId={id} />;
}


