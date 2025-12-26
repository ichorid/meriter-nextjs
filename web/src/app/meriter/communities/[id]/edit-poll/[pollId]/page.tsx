import { EditPollPageClient } from './EditPollPageClient';

interface EditPollPageProps {
  params: { id: string; pollId: string };
}

export default function EditPollPage({ params }: EditPollPageProps) {
  const { id, pollId } = params;
  return <EditPollPageClient communityId={id} pollId={pollId} />;
}
