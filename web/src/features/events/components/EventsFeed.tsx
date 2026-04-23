'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarDays, History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { trpc } from '@/lib/trpc/client';
import { useAuth } from '@/contexts/AuthContext';
import type { EventPublicationView } from '@meriter/shared-types';
import { useCommunity } from '@/hooks/api';
import { EventCard } from './EventCard';
import { EventCreateDialog } from './EventCreateDialog';

function EventCardWithRsvp({
  communityId,
  event,
  isMember,
  isProjectCommunity,
  onRequestJoin,
}: {
  communityId: string;
  event: EventPublicationView;
  isMember?: boolean;
  isProjectCommunity: boolean;
  onRequestJoin: (ev: EventPublicationView) => void;
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
      onRsvpJoinAsNonMember={
        user?.id && !isMember ? () => onRequestJoin(event) : undefined
      }
      isProjectCommunity={isProjectCommunity}
    />
  );
}

function eventMatchesSearch(ev: EventPublicationView, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const title = (ev.title ?? '').toLowerCase();
  const desc = (ev.description ?? '').toLowerCase();
  return title.includes(s) || desc.includes(s);
}

export interface EventsFeedProps {
  communityId: string;
  isMember?: boolean;
  canCreateEvents?: boolean;
  /**
   * When set, controls «New event» row visibility (member/superadmin + server rules).
   * When omitted, falls back to `canCreateEvents` only (legacy).
   */
  showCreateEventToolbar?: boolean;
  /** Client-side filter on title/description (hub toolbar). */
  titleSearch?: string;
  /** When the parent renders the primary «New event» action in the hub toolbar. */
  hideNewEventButton?: boolean;
  /** Controlled open state for `EventCreateDialog` when `hideNewEventButton`. */
  createDialogOpen?: boolean;
  onCreateDialogOpenChange?: (open: boolean) => void;
}

export function EventsFeed({
  communityId,
  isMember,
  canCreateEvents,
  showCreateEventToolbar,
  titleSearch = '',
  hideNewEventButton = false,
  createDialogOpen: createDialogOpenProp,
  onCreateDialogOpenChange,
}: EventsFeedProps) {
  const t = useTranslations('events');
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [createOpenInternal, setCreateOpenInternal] = useState(false);
  const createOpen =
    createDialogOpenProp !== undefined ? createDialogOpenProp : createOpenInternal;
  const setCreateOpen = onCreateDialogOpenChange ?? setCreateOpenInternal;
  const [joinDialogEvent, setJoinDialogEvent] = useState<EventPublicationView | null>(null);
  const { data: community } = useCommunity(communityId);
  const isProjectCommunity = community?.isProject === true;

  const showNewEventRow =
    (showCreateEventToolbar !== undefined ? showCreateEventToolbar : Boolean(canCreateEvents)) &&
    !hideNewEventButton;

  const submitTeam = trpc.teams.submitTeamRequest.useMutation({
    onSuccess: async () => {
      setJoinDialogEvent(null);
      await utils.events.getEventsByCommunity.invalidate({ communityId });
    },
  });
  const joinProject = trpc.project.join.useMutation({
    onSuccess: async () => {
      setJoinDialogEvent(null);
      await utils.events.getEventsByCommunity.invalidate({ communityId });
    },
  });

  const { data, isLoading, isError } = trpc.events.getEventsByCommunity.useQuery({ communityId });

  const filtered = useMemo(() => {
    if (!data) return null;
    const q = titleSearch ?? '';
    return {
      upcoming: data.upcoming.filter((ev) => eventMatchesSearch(ev, q)),
      past: data.past.filter((ev) => eventMatchesSearch(ev, q)),
    };
  }, [data, titleSearch]);

  const confirmJoinRequest = () => {
    if (!joinDialogEvent || !user?.id) return;
    const title = joinDialogEvent.title?.trim() || t('untitledEvent');
    const applicantMessage = t('rsvpJoinRequestNote', { title, id: joinDialogEvent.id }).slice(0, 500);
    if (isProjectCommunity) {
      joinProject.mutate({
        projectId: communityId,
        applicantMessage,
        pendingEventPublicationId: joinDialogEvent.id,
      });
    } else {
      submitTeam.mutate({
        communityId,
        applicantMessage,
        pendingEventPublicationId: joinDialogEvent.id,
      });
    }
  };

  const joinBusy = submitTeam.isPending || joinProject.isPending;

  return (
    <div className="space-y-10">
      {showNewEventRow ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-9 rounded-xl px-3"
            onClick={() => setCreateOpen(true)}
          >
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

      {filtered ? (
        <>
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-base-content/10 pb-2">
              <CalendarDays className="h-5 w-5 shrink-0 text-base-content/50" aria-hidden />
              <h3 className="text-base font-semibold text-base-content">{t('sectionUpcoming')}</h3>
            </div>
            {filtered.upcoming.length === 0 ? (
              <p className="text-sm text-base-content/60">{t('sectionEmptyUpcoming')}</p>
            ) : (
              <div className="flex flex-col gap-4">
                {filtered.upcoming.map((ev) => (
                  <EventCardWithRsvp
                    key={ev.id}
                    communityId={communityId}
                    event={ev}
                    isMember={isMember}
                    isProjectCommunity={isProjectCommunity}
                    onRequestJoin={setJoinDialogEvent}
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
            {filtered.past.length === 0 ? (
              <p className="text-sm text-base-content/60">{t('sectionEmptyPast')}</p>
            ) : (
              <div className="flex flex-col gap-4">
                {filtered.past.map((ev) => (
                  <EventCard key={ev.id} communityId={communityId} event={ev} variant="past" />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      <EventCreateDialog open={createOpen} onOpenChange={setCreateOpen} communityId={communityId} />

      <Dialog open={joinDialogEvent != null} onOpenChange={(o) => !o && setJoinDialogEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('rsvpNeedMembershipTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-base-content/80">{t('rsvpNeedMembershipBody')}</p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setJoinDialogEvent(null)}>
              {t('rsvpNeedMembershipCancel')}
            </Button>
            <Button type="button" disabled={joinBusy} onClick={() => confirmJoinRequest()}>
              {t('rsvpNeedMembershipConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
