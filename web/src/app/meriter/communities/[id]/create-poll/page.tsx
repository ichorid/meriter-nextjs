import { Suspense } from 'react';
import { CreatePollPageClient } from './CreatePollPageClient';

interface CreatePollPageProps {
  params: Promise<{ id: string }>;
}

export default async function CreatePollPage({ params }: CreatePollPageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreatePollPageClient communityId={id} />
    </Suspense>
  );
}


