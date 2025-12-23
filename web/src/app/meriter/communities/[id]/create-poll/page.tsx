import { CreatePollPageClient } from './CreatePollPageClient';

interface CreatePollPageProps {
  params: Promise<{ id: string }>;
}

// Required for static export with dynamic routes
export async function generateStaticParams() {
  // Return empty array - dynamic routes will be handled client-side
  return [];
}

export default async function CreatePollPage({ params }: CreatePollPageProps) {
  const { id } = await params;
  return <CreatePollPageClient communityId={id} />;
}


