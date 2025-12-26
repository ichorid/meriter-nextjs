import { Suspense } from 'react';
import { CreatePollPageClient } from './CreatePollPageClient';

interface CreatePollPageProps {
  params: { id: string };
}

export default function CreatePollPage({ params }: CreatePollPageProps) {
  const { id } = params;
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreatePollPageClient communityId={id} />
    </Suspense>
  );
}


