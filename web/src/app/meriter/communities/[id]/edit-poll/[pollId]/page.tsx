import { EditPollPageClient } from './EditPollPageClient';

interface EditPollPageProps {
  params: { id: string; pollId: string };
}

// Required for static export with dynamic routes
export async function generateStaticParams(): Promise<Array<{ id: string; pollId: string }>> {
  // Return empty array - dynamic routes will be handled client-side
  return [];
}

export default function EditPollPage({ params }: EditPollPageProps) {
  const { id, pollId } = params;
  return <EditPollPageClient communityId={id} pollId={pollId} />;
}
