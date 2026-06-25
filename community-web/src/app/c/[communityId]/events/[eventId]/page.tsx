'use client';

import { AuthGate, Shell } from '@/components/shell';
import { trpc } from '@/lib/trpc/client';
import { formatEventDateRange } from '@/lib/format-dates';

function EventDetailInner({
  communityId,
  eventId,
}: {
  communityId: string;
  eventId: string;
}) {
  const meQuery = trpc.users.getMe.useQuery();
  const pubQuery = trpc.publications.getById.useQuery({ id: eventId });
  const utils = trpc.useUtils();

  const attendMutation = trpc.events.attend.useMutation({
    onSuccess: async () => {
      await utils.publications.getById.invalidate({ id: eventId });
      await utils.events.getEventsByCommunity.invalidate({ communityId });
    },
  });
  const unattendMutation = trpc.events.unattend.useMutation({
    onSuccess: async () => {
      await utils.publications.getById.invalidate({ id: eventId });
      await utils.events.getEventsByCommunity.invalidate({ communityId });
    },
  });
  const deleteMutation = trpc.events.deleteEvent.useMutation({
    onSuccess: () => {
      window.location.href = `/c/${communityId}/events`;
    },
  });
  const inviteMutation = trpc.events.createInviteLink.useMutation();

  const pub = pubQuery.data as {
    id?: string;
    postType?: string;
    title?: string;
    description?: string;
    content?: string;
    eventStartDate?: string | Date;
    eventEndDate?: string | Date;
    eventTime?: string;
    eventLocation?: string;
    eventAttendees?: string[];
    permissions?: { canEdit?: boolean; canDelete?: boolean };
  } | undefined;

  const meId = meQuery.data?.id;
  const isAttending =
    meId != null && (pub?.eventAttendees ?? []).includes(meId);
  const isPast =
    pub?.eventEndDate != null &&
    new Date(pub.eventEndDate).getTime() < Date.now();

  return (
    <Shell communityId={communityId} active="events">
      <div className="space-y-6">
        <a
          href={`/c/${communityId}/events`}
          className="text-sm text-primary hover:underline"
        >
          ← К событиям
        </a>

        {pubQuery.isLoading && (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        )}

        {pub && pub.postType === 'event' && (
          <>
            <header className="space-y-2">
              <h1 className="text-xl font-extrabold tracking-tight">
                {pub.title ?? 'Событие'}
              </h1>
              {pub.eventStartDate && pub.eventEndDate && (
                <p className="text-sm text-stitch-muted">
                  {formatEventDateRange(
                    pub.eventStartDate,
                    pub.eventEndDate,
                    pub.eventTime,
                  )}
                </p>
              )}
              {pub.eventLocation && (
                <p className="text-sm text-stitch-muted">{pub.eventLocation}</p>
              )}
            </header>

            {pub.description && (
              <p className="text-sm whitespace-pre-wrap">{pub.description}</p>
            )}
            {!pub.description && pub.content && (
              <p className="text-sm whitespace-pre-wrap">{pub.content}</p>
            )}

            <div className="rounded-xl border border-stitch-border bg-stitch-surface p-4 text-sm">
              Участников: {pub.eventAttendees?.length ?? 0}
            </div>

            {!isPast && (
              <div className="flex flex-wrap gap-2">
                {isAttending ? (
                  <button
                    type="button"
                    disabled={unattendMutation.isPending}
                    onClick={() => unattendMutation.mutate({ publicationId: eventId })}
                    className="rounded-lg border border-stitch-border px-4 py-2 text-sm hover:bg-stitch-surface"
                  >
                    Отменить участие
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={attendMutation.isPending}
                    onClick={() => attendMutation.mutate({ publicationId: eventId })}
                    className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    Я пойду
                  </button>
                )}
              </div>
            )}

            {pub.permissions?.canDelete && (
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ publicationId: eventId })}
                className="text-sm text-red-400 hover:underline"
              >
                Удалить событие
              </button>
            )}

            {pub.permissions?.canEdit && (
              <button
                type="button"
                disabled={inviteMutation.isPending}
                onClick={async () => {
                  const result = await inviteMutation.mutateAsync({
                    publicationId: eventId,
                    options: {},
                  });
                  const token = (result as { token?: string }).token;
                  if (token && typeof navigator !== 'undefined' && navigator.clipboard) {
                    await navigator.clipboard.writeText(token);
                  }
                }}
                className="text-sm text-primary hover:underline"
              >
                Скопировать токен приглашения
              </button>
            )}

            {(attendMutation.isError || unattendMutation.isError) && (
              <p className="text-sm text-red-400">Не удалось обновить участие.</p>
            )}
            {inviteMutation.isSuccess && (
              <p className="text-sm text-green-400">Токен приглашения скопирован.</p>
            )}
          </>
        )}

        {pub && pub.postType !== 'event' && (
          <p className="text-sm text-red-400">Публикация не является событием.</p>
        )}
      </div>
    </Shell>
  );
}

export default function EventDetailPage({
  params,
}: {
  params: { communityId: string; eventId: string };
}) {
  return (
    <AuthGate>
      <EventDetailInner
        communityId={params.communityId}
        eventId={params.eventId}
      />
    </AuthGate>
  );
}
