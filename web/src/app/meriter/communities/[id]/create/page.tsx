import { Suspense } from 'react';
import { CreatePublicationPageClient } from './CreatePublicationPageClient';

interface CreatePublicationPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return {
    title: 'Create Post',
  };
}

export default async function CreatePublicationPage({ params }: CreatePublicationPageProps) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-base-content/60">
          Loading…
        </div>
      }
    >
      <CreatePublicationPageClient communityId={id} />
    </Suspense>
  );
}


