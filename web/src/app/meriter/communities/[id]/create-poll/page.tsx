import { Suspense } from 'react';
import { CreatePollPageClient } from './CreatePollPageClient';

interface CreatePollPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return {
    title: 'Create Poll',
  };
}

export default async function CreatePollPage({ params }: CreatePollPageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreatePollPageClient communityId={id} />
    </Suspense>
  );
}


