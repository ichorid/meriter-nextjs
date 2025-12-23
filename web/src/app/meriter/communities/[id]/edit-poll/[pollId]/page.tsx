import { EditPollPageClient } from './EditPollPageClient';

interface EditPollPageProps {
  params: Promise<{ id: string; pollId: string }>;
}

// Required for static export with dynamic routes
export async function generateStaticParams() {
  // Return empty array - dynamic routes will be handled client-side
  return [];
}

export default async function EditPollPage({ params }: EditPollPageProps) {
  const { id, pollId } = await params;
  return <EditPollPageClient communityId={id} pollId={pollId} />;
}
