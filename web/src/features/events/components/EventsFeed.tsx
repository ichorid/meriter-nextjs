'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarDays, History, Loader2 } from 'lucide-react';
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
    <div className="space-y-10">
      {canCreateEvents ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" size="sm" className="h-9 rounded-xl px-3" onClick={() => setCreateOpen(true)}>
            {t('newEvent')}
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" aria-hidden />
        </div>
      ) : null}
      {isError ? <p className="text-sm text-error">{t('feedError')}</p> : null}

      {data ? (
        <>
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-base-content/10 pb-2">
              <CalendarDays className="h-5 w-5 shrink-0 text-base-content/50" aria-hidden />
              <h3 className="text-base font-semibold text-base-content">{t('sectionUpcoming')}</h3>
            </div>
            {data.upcoming.length === 0 ? (
              <p className="text-sm text-base-content/60">{t('sectionEmptyUpcoming')}</p>
            ) : (
              <div className="flex flex-col gap-4">
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

          <section className="space-y-4 border-t border-base-content/10 pt-8">
            <div className="flex items-center gap-2 border-b border-base-content/10 pb-2">
              <History className="h-5 w-5 shrink-0 text-base-content/50" aria-hidden />
              <h3 className="text-base font-semibold text-base-content">{t('sectionPast')}</h3>
            </div>
            {data.past.length === 0 ? (
              <p className="text-sm text-base-content/60">{t('sectionEmptyPast')}</p>
            ) : (
              <div className="flex flex-col gap-4">
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
