import { CreatePollPageClient } from './CreatePollPageClient';

interface CreatePollPageProps {
  params: { id: string };
}

// Required for static export with dynamic routes
export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  // Return empty array - dynamic routes will be handled client-side
  return [];
}

export default function CreatePollPage({ params }: CreatePollPageProps) {
  const { id } = params;
  return <CreatePollPageClient communityId={id} />;
}


