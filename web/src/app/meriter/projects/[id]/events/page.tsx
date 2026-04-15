import { Suspense } from 'react';
import { EventsContextPage } from '@/features/events/pages/EventsContextPage';
import { routes } from '@/lib/constants/routes';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return { title: 'Events' };
}

export default async function ProjectEventsPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-base-content/60">
          Loading…
        </div>
      }
    >
      <EventsContextPage communityId={id} backHref={routes.project(id)} />
    </Suspense>
  );
}
