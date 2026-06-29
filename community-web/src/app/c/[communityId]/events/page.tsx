'use client';

import { useState } from 'react';
import { AuthGate } from '@/components/shell';
import { CommunityShell } from '@/components/community-shell';
import { useCommunityId } from '@/lib/use-route-params';
import { trpc } from '@/lib/trpc/client';
import { formatEventDateRange, fromDatetimeLocalValue } from '@/lib/format-dates';

type EventItem = {
  id: string;
  title?: string;
  description?: string;
  content: string;
  eventStartDate: string | Date;
  eventEndDate: string | Date;
  eventTime?: string;
  eventLocation?: string;
  eventAttendees?: string[];
};

function EventCard({
  event,
  communityId,
  muted,
}: {
  event: EventItem;
  communityId: string;
  muted?: boolean;
}) {
  const attendeeCount = event.eventAttendees?.length ?? 0;
  return (
    <a
      href={`/c/${communityId}/events/${event.id}`}
      className={`block rounded-xl border border-stitch-border bg-stitch-surface p-4 hover:border-primary/50 transition-colors ${muted ? 'opacity-80' : ''}`}
    >
      <p className="font-semibold">
        {event.title ?? event.content.slice(0, 80)}
      </p>
      <p className="mt-1 text-sm text-stitch-muted">
        {formatEventDateRange(
          event.eventStartDate,
          event.eventEndDate,
          event.eventTime,
        )}
      </p>
      {event.eventLocation && (
        <p className="mt-1 text-sm text-stitch-muted">{event.eventLocation}</p>
      )}
      <p className="mt-2 text-xs text-stitch-muted">
        Участников: {attendeeCount}
      </p>
    </a>
  );
}

function EventCreateForm({ communityId }: { communityId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const utils = trpc.useUtils();

  const createMutation = trpc.events.createEvent.useMutation({
    onSuccess: async () => {
      setTitle('');
      setDescription('');
      setStartAt('');
      setEndAt('');
      setEventTime('');
      setEventLocation('');
      setOpen(false);
      await utils.events.getEventsByCommunity.invalidate({ communityId });
    },
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
      >
        Создать событие
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-3">
      <h2 className="font-semibold">Новое событие</h2>
      <input
        className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
        placeholder="Название"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="w-full min-h-[80px] rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
        placeholder="Описание"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span>Начало</span>
          <input
            type="datetime-local"
            className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Окончание</span>
          <input
            type="datetime-local"
            className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
          />
        </label>
      </div>
      <input
        className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
        placeholder="Время (текст, необязательно)"
        value={eventTime}
        onChange={(e) => setEventTime(e.target.value)}
      />
      <input
        className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm"
        placeholder="Место"
        value={eventLocation}
        onChange={(e) => setEventLocation(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={
            !title.trim() ||
            !description.trim() ||
            !startAt ||
            !endAt ||
            createMutation.isPending
          }
          onClick={() =>
            createMutation.mutate({
              communityId,
              title: title.trim(),
              description: description.trim(),
              content: description.trim(),
              type: 'text',
              eventStartDate: fromDatetimeLocalValue(startAt),
              eventEndDate: fromDatetimeLocalValue(endAt),
              eventTime: eventTime.trim() || undefined,
              eventLocation: eventLocation.trim() || undefined,
            })
          }
          className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Опубликовать
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-stitch-muted"
        >
          Отмена
        </button>
      </div>
      {createMutation.isError && (
        <p className="text-sm text-red-400">Не удалось создать событие.</p>
      )}
    </div>
  );
}

function EventsInner({ communityId }: { communityId: string }) {
  const eventsQuery = trpc.events.getEventsByCommunity.useQuery({ communityId });

  return (
    <CommunityShell communityId={communityId} active="events" tgActive="feed">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold tracking-tight">События</h1>
          <EventCreateForm communityId={communityId} />
        </div>

        {eventsQuery.isLoading && (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-stitch-muted">Предстоящие</h2>
          <ul className="space-y-3">
            {(eventsQuery.data?.upcoming ?? []).map((event) => (
              <li key={event.id}>
                <EventCard event={event} communityId={communityId} />
              </li>
            ))}
          </ul>
          {!eventsQuery.isLoading &&
            (eventsQuery.data?.upcoming ?? []).length === 0 && (
              <p className="text-sm text-stitch-muted">Нет предстоящих событий.</p>
            )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-stitch-muted">Прошедшие</h2>
          <ul className="space-y-3">
            {(eventsQuery.data?.past ?? []).map((event) => (
              <li key={event.id}>
                <EventCard event={event} communityId={communityId} muted />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </CommunityShell>
  );
}

export default function EventsPage() {
  const communityId = useCommunityId();
  return (
    <AuthGate>
      <EventsInner communityId={communityId} />
    </AuthGate>
  );
}
