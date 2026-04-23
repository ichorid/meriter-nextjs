'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { QrCode } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/shadcn/avatar';
import { MeritTransferButton } from '@/features/merit-transfer';
import { useCommunityMembers } from '@/hooks/api/useCommunityMembers';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc/client';
import { isParticipantRsvpLockedClient, type EventParticipantLite } from '../lib/event-rsvp-lock';
import { EventParticipantCheckInQRDialog } from './EventParticipantCheckInQRDialog';

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
  eventParticipants?: EventParticipantLite[];
  eventStartDate?: string | Date | null;
  eventEndDate?: string | Date | null;
  eventTime?: string | null;
  isMember: boolean;
  isAttending: boolean;
  canManageAttendance: boolean;
  /** Logged-in non-member: opens join + deferred RSVP dialog (same flow as events feed). */
  onRsvpJoinAsNonMember?: () => void;
}

export function EventRSVP({
  publicationId,
  communityId,
  attendeeIds,
  attendeeSummaries,
  eventParticipants,
  eventStartDate,
  eventEndDate,
  eventTime,
  isMember,
  isAttending,
  canManageAttendance,
  onRsvpJoinAsNonMember,
}: EventRSVPProps) {
  const t = useTranslations('events');
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [qrOpen, setQrOpen] = useState(false);

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

  const setAttendance = trpc.events.setParticipantAttendance.useMutation({
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

  const participantById = useMemo(() => {
    const m = new Map<string, EventParticipantLite>();
    for (const p of eventParticipants ?? []) {
      m.set(p.userId, p);
    }
    return m;
  }, [eventParticipants]);

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
  const rsvpLocked =
    user?.id != null
      ? isParticipantRsvpLockedClient(
            { eventStartDate, eventEndDate, eventTime },
            user.id,
            eventParticipants,
        )
      : false;

  const attendanceLabel = (uid: string) => {
    const att = participantById.get(uid)?.attendance;
    if (att === 'checked_in') return t('attendancePresent');
    if (att === 'no_show') return t('attendanceAbsent');
    return null;
  };

  return (
    <div className="space-y-4 rounded-lg border border-base-content/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-medium">{t('rsvpHeading')}</h3>
        {isMember ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={isAttending ? 'secondary' : 'default'}
              disabled={busy || rsvpLocked}
              onClick={() =>
                isAttending ? unattend.mutate({ publicationId }) : attend.mutate({ publicationId })
              }
            >
              {isAttending ? t('rsvpLeave') : t('rsvpJoin')}
            </Button>
            {isAttending && !rsvpLocked ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setQrOpen(true)}
              >
                <QrCode className="h-4 w-4 shrink-0" aria-hidden />
                {t('showMyCheckInQr')}
              </Button>
            ) : null}
          </div>
        ) : user?.id && onRsvpJoinAsNonMember ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="default" disabled={busy} onClick={() => onRsvpJoinAsNonMember()}>
              {t('rsvpJoin')}
            </Button>
          </div>
        ) : null}
      </div>
      {rsvpLocked && isMember ? (
        <p className="text-sm text-base-content/60">
          {(() => {
            const row = user?.id ? participantById.get(user.id) : undefined;
            if (row?.attendance === 'checked_in' || row?.attendance === 'no_show') {
              return t('rsvpLockedReasonAttendance');
            }
            return t('rsvpLockedReasonEnded');
          })()}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-base-content/60">{t('rsvpEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((m) => {
            const attText = attendanceLabel(m.id);
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Avatar className="h-9 w-9">
                    {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
                    <AvatarFallback>{m.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-medium">{m.displayName}</span>
                    {attText ? (
                      <span className="text-xs text-base-content/50">{attText}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  {canManageAttendance ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        disabled={setAttendance.isPending}
                        onClick={() =>
                          setAttendance.mutate({
                            publicationId,
                            targetUserId: m.id,
                            attendance: 'checked_in',
                          })
                        }
                      >
                        {t('attendanceSetPresent')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        disabled={setAttendance.isPending}
                        onClick={() =>
                          setAttendance.mutate({
                            publicationId,
                            targetUserId: m.id,
                            attendance: 'no_show',
                          })
                        }
                      >
                        {t('attendanceSetAbsent')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        disabled={setAttendance.isPending}
                        onClick={() =>
                          setAttendance.mutate({
                            publicationId,
                            targetUserId: m.id,
                            attendance: null,
                          })
                        }
                      >
                        {t('attendanceClear')}
                      </Button>
                    </>
                  ) : null}
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
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <EventParticipantCheckInQRDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        publicationId={publicationId}
      />
    </div>
  );
}
