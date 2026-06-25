'use client';

import { AuthGate, Shell } from '@/components/shell';
import { trpc } from '@/lib/trpc/client';

function EventsInner({ communityId }: { communityId: string }) {
  const eventsQuery = trpc.events.getEventsByCommunity.useQuery({ communityId });

  return (
    <Shell communityId={communityId} active="events">
      <div className="space-y-6">
        <h1 className="text-xl font-extrabold tracking-tight">События</h1>
        <section>
          <h2 className="mb-2 text-sm font-semibold text-stitch-muted">Предстоящие</h2>
          <ul className="space-y-3">
            {(eventsQuery.data?.upcoming ?? []).map((event) => (
              <li
                key={event.id}
                className="rounded-xl border border-stitch-border bg-stitch-surface p-4"
              >
                <p className="font-semibold">{event.title ?? event.content?.slice(0, 80)}</p>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold text-stitch-muted">Прошедшие</h2>
          <ul className="space-y-3">
            {(eventsQuery.data?.past ?? []).map((event) => (
              <li
                key={event.id}
                className="rounded-xl border border-stitch-border bg-stitch-surface p-4 opacity-80"
              >
                <p className="font-semibold">{event.title ?? event.content?.slice(0, 80)}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}

export default function EventsPage({
  params,
}: {
  params: { communityId: string };
}) {
  return (
    <AuthGate>
      <EventsInner communityId={params.communityId} />
    </AuthGate>
  );
}
