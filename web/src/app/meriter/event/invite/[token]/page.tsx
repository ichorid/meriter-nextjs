import { Suspense } from 'react';
import { EventInviteLanding } from '@/features/events';

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata() {
  return { title: 'Event invite' };
}

export default async function EventInvitePage({ params }: PageProps) {
  const { token } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-base-content/60">
          Loading…
        </div>
      }
    >
      <EventInviteLanding token={token} />
    </Suspense>
  );
}
