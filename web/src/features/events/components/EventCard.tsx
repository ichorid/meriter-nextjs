'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { EventPublicationView } from '@meriter/shared-types';
import { Card, CardContent, CardHeader } from '@/components/ui/shadcn/card';
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/ui/shadcn/badge';
import { MapPin, Users } from 'lucide-react';
import { routes } from '@/lib/constants/routes';
import { getDaysUntilEventStart, getEventStatus } from '../lib/event-status';
import { cn } from '@/lib/utils';

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
}

export function EventCard({
  communityId,
  event,
  variant = 'default',
  isMember,
  isAttending,
  onToggleRsvp,
  rsvpBusy,
}: EventCardProps) {
  const t = useTranslations('events');
  const start = new Date(event.eventStartDate);
  const end = new Date(event.eventEndDate);
  const status = getEventStatus(start, end);
  const daysUntil = getDaysUntilEventStart(start);
  const href = routes.eventView(communityId, event.id);
  const count = event.eventAttendees?.length ?? 0;

  const statusLabel =
    status === 'upcoming'
      ? t('statusUpcoming')
      : status === 'active'
        ? t('statusActive')
        : t('statusPast');

  return (
    <Card
      className={cn(
        'transition-colors',
        variant === 'past' && 'border-base-content/10 bg-base-200/40 opacity-90',
      )}
    >
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
        <div className="min-w-0 flex-1">
          <Link href={href} className="font-semibold text-brand-primary hover:underline">
            {event.title ?? t('untitledEvent')}
          </Link>
          <p className="text-sm text-base-content/70">
            {start.toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}{' '}
            —{' '}
            {end.toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>
        <Badge variant={status === 'past' ? 'secondary' : 'default'}>{statusLabel}</Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {daysUntil != null && status === 'upcoming' ? (
          <p className="text-base-content/70">{t('startsInDays', { count: daysUntil })}</p>
        ) : null}
        {event.eventLocation ? (
          <p className="flex items-center gap-1 text-base-content/80">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            <span className="break-words">{event.eventLocation}</span>
          </p>
        ) : null}
        <p className="flex items-center gap-1 text-base-content/80">
          <Users className="h-4 w-4 shrink-0" aria-hidden />
          {t('attendeeCount', { count })}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild variant="outline" size="sm">
            <Link href={href}>{t('openEvent')}</Link>
          </Button>
          {isMember && onToggleRsvp ? (
            <Button
              type="button"
              size="sm"
              variant={isAttending ? 'secondary' : 'default'}
              disabled={rsvpBusy}
              onClick={() => onToggleRsvp()}
            >
              {isAttending ? t('rsvpLeave') : t('rsvpJoin')}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
