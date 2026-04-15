'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { MapPin, Users, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/shadcn/button';
import { Card, CardContent, CardHeader } from '@/components/ui/shadcn/card';
import { Badge } from '@/components/ui/shadcn/badge';
import { routes } from '@/lib/constants/routes';
import { useToastStore } from '@/shared/stores/toast.store';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';
import { getEventStatus } from '../lib/event-status';

export interface EventInviteLandingProps {
  token: string;
}

export function EventInviteLanding({ token }: EventInviteLandingProps) {
  const router = useRouter();
  const t = useTranslations('events');
  const { user } = useAuth();
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();

  const preview = trpc.events.getInvitePreview.useQuery({ token });
  const attend = trpc.events.attendViaInvite.useMutation({
    onSuccess: async () => {
      addToast(t('inviteConfirmSuccess'), 'success');
      if (preview.data) {
        await utils.events.getInvitePreview.invalidate({ token });
      }
    },
    onError: (e) => {
      addToast(resolveApiErrorToastMessage(e.message), 'error');
    },
  });

  const data = preview.data;
  const start = data?.eventStartDate ? new Date(data.eventStartDate) : null;
  const end = data?.eventEndDate ? new Date(data.eventEndDate) : null;
  const status = start && end ? getEventStatus(start, end) : null;
  const statusLabel =
    status === 'upcoming'
      ? t('statusUpcoming')
      : status === 'active'
        ? t('statusActive')
        : status === 'past'
          ? t('statusPast')
          : '';

  const returnTo = typeof window !== 'undefined' ? window.location.pathname : routes.home;

  const onConfirm = async () => {
    try {
      await attend.mutateAsync({ token });
      if (data?.communityId && data.publicationId) {
        router.push(routes.eventView(data.communityId, data.publicationId));
      }
    } catch {
      /* toast in onError */
    }
  };

  if (preview.isLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-base-content/70">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        <p className="text-sm">{t('inviteLandingLoading')}</p>
      </div>
    );
  }

  if (preview.isError || !data) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <p className="text-error">{t('inviteLandingInvalid')}</p>
        <Button type="button" variant="outline" onClick={() => router.push(routes.home)}>
          {t('inviteLandingGoHome')}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <h1 className="text-xl font-semibold">{t('inviteLandingTitle')}</h1>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-medium">{data.title?.trim() || t('untitledEvent')}</p>
            {start && end ? (
              <p className="text-sm text-base-content/70">
                {start.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} —{' '}
                {end.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            ) : null}
          </div>
          {statusLabel ? <Badge variant="secondary">{statusLabel}</Badge> : null}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {data.description ? <p className="text-base-content/80">{data.description}</p> : null}
          {data.eventTime ? (
            <p className="text-base-content/80">
              {t('eventTimeLabel')}: {data.eventTime}
            </p>
          ) : null}
          {data.eventLocation ? (
            <p className="flex items-start gap-1 text-base-content/80">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{data.eventLocation}</span>
            </p>
          ) : null}
          <p className="flex items-center gap-1 text-base-content/80">
            <Users className="h-4 w-4 shrink-0" aria-hidden />
            {t('attendeeCount', { count: data.attendeeCount })}
          </p>
        </CardContent>
      </Card>

      {user?.id ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={attend.isPending} onClick={() => void onConfirm()}>
            {attend.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('inviteConfirmAttend')}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={routes.eventView(data.communityId, data.publicationId)}>{t('inviteOpenEventPage')}</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-base-content/70">{t('inviteLoginToConfirm')}</p>
          <Button type="button" asChild>
            <Link href={`${routes.login}?returnTo=${encodeURIComponent(returnTo)}`}>{t('inviteSignIn')}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
