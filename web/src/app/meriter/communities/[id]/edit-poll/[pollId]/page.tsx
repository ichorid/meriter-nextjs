import { EditPollPageClient } from './EditPollPageClient';

interface EditPollPageProps {
  params: Promise<{ id: string; pollId: string }>;
}

export default async function EditPollPage({ params }: EditPollPageProps) {
  const { id, pollId } = await params;
  return <EditPollPageClient communityId={id} pollId={pollId} />;
}
