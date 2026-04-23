'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { EventPublicationView } from '@meriter/shared-types';
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/ui/shadcn/badge';
import { CalendarClock, MapPin, Users } from 'lucide-react';
import { routes } from '@/lib/constants/routes';
import { getDaysUntilEventStart, getEventStatus } from '../lib/event-status';
import { cn } from '@/lib/utils';
import { plainTextExcerpt } from '@/lib/utils/plain-text-excerpt';

export interface EventCardProps {
  communityId: string;
  event: EventPublicationView;
  /** Muted styling for past block */
  variant?: 'default' | 'past';
  /** Show RSVP toggle when user is a member */
  isMember?: boolean;
  isAttending?: boolean;
  onToggleRsvp?: () => void;
  rsvpBusy?: boolean;
  /** Logged-in non-member: opens join flow with deferred RSVP (feed). */
  onRsvpJoinAsNonMember?: () => void;
}

export function EventCard({
  communityId,
  event,
  variant = 'default',
  isMember,
  isAttending,
  onToggleRsvp,
  rsvpBusy,
  onRsvpJoinAsNonMember,
}: EventCardProps) {
  const t = useTranslations('events');
  const start = new Date(event.eventStartDate);
  const end = new Date(event.eventEndDate);
  const status = getEventStatus(start, end);
  const daysUntil = getDaysUntilEventStart(start);
  const href = routes.eventView(communityId, event.id);
  const count = event.eventAttendees?.length ?? 0;
  const excerptSource = event.description?.trim() || event.content;
  const excerpt = excerptSource ? plainTextExcerpt(excerptSource, 200) : '';

  const statusLabel =
    status === 'upcoming'
      ? t('statusUpcoming')
      : status === 'active'
        ? t('statusActive')
        : t('statusPast');

  const titleText = event.title?.trim() || t('untitledEvent');
  const dateLine = `${start.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })} — ${end.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })}`;

  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden bg-[#F5F5F5] dark:bg-[#2a3239] p-5 shadow-none',
        'transition-all duration-300 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        variant === 'past'
          ? 'opacity-[0.94] saturate-[0.85] hover:opacity-100 hover:saturate-100 hover:shadow-[0_6px_14px_rgba(0,0,0,0.12)] hover:scale-[1.005] hover:-translate-y-0.5'
          : 'hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)] hover:scale-[1.01] hover:-translate-y-0.5',
      )}
    >
      <Link
        href={href}
        className="block min-w-0 outline-none rounded-lg"
        aria-label={`${titleText}. ${dateLine}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <h3 className="text-lg font-semibold text-base-content leading-tight line-clamp-2 flex-1 min-w-0">
            {titleText}
          </h3>
          <Badge variant={status === 'past' ? 'secondary' : 'default'} className="shrink-0">
            {statusLabel}
          </Badge>
        </div>

        {excerpt ? (
          <p className="text-sm text-base-content/70 mb-3 line-clamp-2">{excerpt}</p>
        ) : null}

        {daysUntil != null && status === 'upcoming' ? (
          <p className="text-sm font-medium text-base-content/80 mb-2">{t('startsInDays', { count: daysUntil })}</p>
        ) : null}

        <div className="space-y-2 text-sm text-base-content/75">
          <p className="flex items-start gap-2 min-w-0">
            <CalendarClock className="h-4 w-4 shrink-0 mt-0.5 text-base-content/50" aria-hidden />
            <span className="min-w-0 break-words">{dateLine}</span>
          </p>
          {event.eventTime ? (
            <p className="flex items-start gap-2 pl-6 -mt-1 text-base-content/60">{event.eventTime}</p>
          ) : null}
          {event.eventLocation ? (
            <p className="flex items-start gap-2 min-w-0">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-base-content/50" aria-hidden />
              <span className="min-w-0 break-words">{event.eventLocation}</span>
            </p>
          ) : null}
          <p className="flex items-center gap-2 text-base-content/70">
            <Users className="h-4 w-4 shrink-0 text-base-content/50" aria-hidden />
            {t('attendeeCount', { count })}
          </p>
        </div>
      </Link>

      <div className="pt-3 border-t border-base-300 mt-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg px-2.5 text-xs shrink-0">
            <Link href={href}>{t('openEvent')}</Link>
          </Button>
          {isMember && onToggleRsvp ? (
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-lg px-2.5 text-xs shrink-0"
              variant={isAttending ? 'secondary' : 'default'}
              disabled={rsvpBusy}
              onClick={() => onToggleRsvp()}
            >
              {isAttending ? t('rsvpLeave') : t('rsvpJoin')}
            </Button>
          ) : null}
          {!isMember && onRsvpJoinAsNonMember && variant !== 'past' && status !== 'past' ? (
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-lg px-2.5 text-xs shrink-0"
              variant="default"
              disabled={rsvpBusy}
              onClick={() => onRsvpJoinAsNonMember()}
            >
              {t('rsvpJoin')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
