import { EditPollPageClient } from './EditPollPageClient';

interface EditPollPageProps {
  params: { id: string; pollId: string };
}

// Required for static export with dynamic routes
// Return a placeholder to satisfy static export requirements
// Actual routing will be handled client-side
export async function generateStaticParams(): Promise<Array<{ id: string; pollId: string }>> {
  return [{ id: '_', pollId: '_' }];
}

export default function EditPollPage({ params }: EditPollPageProps) {
  const { id, pollId } = params;
  return <EditPollPageClient communityId={id} pollId={pollId} />;
}
