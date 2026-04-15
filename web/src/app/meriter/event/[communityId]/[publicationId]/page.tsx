import { Suspense } from 'react';
import { EventPage } from '@/features/events';

interface PageProps {
  params: Promise<{ communityId: string; publicationId: string }>;
}

export async function generateMetadata() {
  return { title: 'Event' };
}

export default async function EventViewPage({ params }: PageProps) {
  const { communityId, publicationId } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-base-content/60">
          Loading…
        </div>
      }
    >
      <EventPage communityId={communityId} publicationId={publicationId} />
    </Suspense>
  );
}
