'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { trpc } from '@/lib/trpc/client';
import { useAuth } from '@/contexts/AuthContext';
import type { EventPublicationView } from '@meriter/shared-types';
import { EventCard } from './EventCard';
import { EventCreateDialog } from './EventCreateDialog';

function EventCardWithRsvp({
  communityId,
  event,
  isMember,
}: {
  communityId: string;
  event: EventPublicationView;
  isMember?: boolean;
}) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const attend = trpc.events.attend.useMutation({
    onSuccess: async () => {
      await utils.events.getEventsByCommunity.invalidate({ communityId });
    },
  });
  const unattend = trpc.events.unattend.useMutation({
    onSuccess: async () => {
      await utils.events.getEventsByCommunity.invalidate({ communityId });
    },
  });
  const going = Boolean(user?.id && event.eventAttendees.includes(user.id));
  const busy = attend.isPending || unattend.isPending;

  return (
    <EventCard
      communityId={communityId}
      event={event}
      variant="default"
      isMember={isMember}
      isAttending={going}
      rsvpBusy={busy}
      onToggleRsvp={
        isMember
          ? () =>
              going
                ? unattend.mutate({ publicationId: event.id })
                : attend.mutate({ publicationId: event.id })
          : undefined
      }
    />
  );
}

export interface EventsFeedProps {
  communityId: string;
  isMember?: boolean;
  canCreateEvents?: boolean;
}

export function EventsFeed({ communityId, isMember, canCreateEvents }: EventsFeedProps) {
  const t = useTranslations('events');
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading, isError } = trpc.events.getEventsByCommunity.useQuery({ communityId });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{t('feedTitle')}</h2>
        {canCreateEvents ? (
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            {t('newEvent')}
          </Button>
        ) : null}
      </div>

      {isLoading ? <p className="text-sm text-base-content/60">{t('feedLoading')}</p> : null}
      {isError ? <p className="text-sm text-error">{t('feedError')}</p> : null}

      {data ? (
        <>
          <section className="space-y-3">
            <h3 className="text-sm font-medium uppercase tracking-wide text-base-content/60">
              {t('sectionUpcoming')}
            </h3>
            {data.upcoming.length === 0 ? (
              <p className="text-sm text-base-content/60">{t('sectionEmptyUpcoming')}</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {data.upcoming.map((ev) => (
                  <EventCardWithRsvp
                    key={ev.id}
                    communityId={communityId}
                    event={ev}
                    isMember={isMember}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium uppercase tracking-wide text-base-content/60">
              {t('sectionPast')}
            </h3>
            {data.past.length === 0 ? (
              <p className="text-sm text-base-content/60">{t('sectionEmptyPast')}</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {data.past.map((ev) => (
                  <EventCard key={ev.id} communityId={communityId} event={ev} variant="past" />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      <EventCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        communityId={communityId}
      />
    </div>
  );
}
