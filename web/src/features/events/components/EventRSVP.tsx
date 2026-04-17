'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/shadcn/avatar';
import { MeritTransferButton } from '@/features/merit-transfer';
import { useCommunityMembers } from '@/hooks/api/useCommunityMembers';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc/client';

/** Populated by publications.getById for events (displayName / avatar for RSVP list). */
export type EventAttendeeSummary = {
  id: string;
  name: string;
  username?: string;
  photoUrl?: string;
};

export interface EventRSVPProps {
  publicationId: string;
  communityId: string;
  attendeeIds: string[];
  /** When set (from getById), used instead of resolving names from paginated community members. */
  attendeeSummaries?: EventAttendeeSummary[];
  isMember: boolean;
  isAttending: boolean;
}

export function EventRSVP({
  publicationId,
  communityId,
  attendeeIds,
  attendeeSummaries,
  isMember,
  isAttending,
}: EventRSVPProps) {
  const t = useTranslations('events');
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const attend = trpc.events.attend.useMutation({
    onSuccess: async () => {
      await utils.events.getEventsByCommunity.invalidate({ communityId });
      await utils.publications.getById.invalidate({ id: publicationId });
    },
  });
  const unattend = trpc.events.unattend.useMutation({
    onSuccess: async () => {
      await utils.events.getEventsByCommunity.invalidate({ communityId });
      await utils.publications.getById.invalidate({ id: publicationId });
    },
  });

  const { data: membersRes } = useCommunityMembers(communityId, { limit: 100 });
  const memberById = useMemo(() => {
    const m = new Map<string, { id: string; displayName: string; avatarUrl?: string }>();
    for (const row of membersRes?.data ?? []) {
      m.set(row.id, {
        id: row.id,
        displayName: row.displayName || row.username || row.id,
        avatarUrl: row.avatarUrl,
      });
    }
    return m;
  }, [membersRes?.data]);

  const rows = useMemo(() => {
    if (attendeeSummaries && attendeeSummaries.length > 0) {
      const byId = new Map(attendeeSummaries.map((s) => [s.id, s]));
      return attendeeIds.map((id) => {
        const s = byId.get(id);
        if (s) {
          return { id: s.id, displayName: s.name, avatarUrl: s.photoUrl };
        }
        return memberById.get(id) ?? { id, displayName: id, avatarUrl: undefined };
      });
    }
    return attendeeIds.map(
      (id) => memberById.get(id) ?? { id, displayName: id, avatarUrl: undefined },
    );
  }, [attendeeIds, attendeeSummaries, memberById]);

  const busy = attend.isPending || unattend.isPending;

  return (
    <div className="space-y-4 rounded-lg border border-base-content/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-medium">{t('rsvpHeading')}</h3>
        {isMember ? (
          <Button
            type="button"
            size="sm"
            variant={isAttending ? 'secondary' : 'default'}
            disabled={busy}
            onClick={() =>
              isAttending
                ? unattend.mutate({ publicationId })
                : attend.mutate({ publicationId })
            }
          >
            {isAttending ? t('rsvpLeave') : t('rsvpJoin')}
          </Button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-base-content/60">{t('rsvpEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Avatar className="h-9 w-9">
                  {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
                  <AvatarFallback>{m.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-medium">{m.displayName}</span>
              </div>
              {user?.id && user.id !== m.id ? (
                <MeritTransferButton
                  receiverId={m.id}
                  receiverDisplayName={m.displayName}
                  communityContextId={communityId}
                  eventPostId={publicationId}
                  iconOnly
                  size="sm"
                  onSuccess={() => {
                    void utils.comments.getByPublicationId.invalidate({ publicationId });
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
