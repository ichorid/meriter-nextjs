'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';

const PAGE_SIZE = 20;

type CastRow = {
  id: string;
  userId: string;
  userDisplayName: string;
  avatarUrl?: string;
  optionId: string;
  optionText: string;
  amount: number;
  direction: 'up' | 'down';
  createdAt: string;
};

type CasterRow = {
  userId: string;
  userDisplayName: string;
  avatarUrl?: string;
  totalUp: number;
  totalDown: number;
};

function CastAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stitch-canvas text-xs font-semibold text-stitch-muted">
      {name.slice(0, 1).toUpperCase() || '?'}
    </span>
  );
}

function formatCastTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function CastFeedRow({ cast }: { cast: CastRow }) {
  const isUp = cast.direction === 'up';
  return (
    <li className="flex items-center gap-3 py-2">
      <CastAvatar name={cast.userDisplayName} avatarUrl={cast.avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{cast.userDisplayName}</p>
        <p className="truncate text-xs text-stitch-muted">
          {isUp ? 'За' : 'Против'} «{cast.optionText}» · {formatCastTime(cast.createdAt)}
        </p>
      </div>
      <span
        className={`shrink-0 text-sm font-semibold tabular-nums ${
          isUp ? 'text-green-400' : 'text-red-400'
        }`}
      >
        {isUp ? '+' : '−'}
        {cast.amount}
      </span>
    </li>
  );
}

function CastRowsPage({ pollId, skip }: { pollId: string; skip: number }) {
  const query = trpc.polls.getCasts.useQuery({ pollId, skip, limit: PAGE_SIZE });
  const items = (query.data?.items ?? []) as CastRow[];

  if (query.isLoading) {
    return <li className="py-2 text-sm text-stitch-muted">Загрузка…</li>;
  }
  return (
    <>
      {items.map((cast) => (
        <CastFeedRow key={cast.id} cast={cast} />
      ))}
    </>
  );
}

function TopCasters({ casters }: { casters: CasterRow[] }) {
  if (casters.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-stitch-muted">Топ участников</h3>
      <ul className="space-y-1">
        {casters.map((caster) => (
          <li key={caster.userId} className="flex items-center gap-3 py-1">
            <CastAvatar name={caster.userDisplayName} avatarUrl={caster.avatarUrl} />
            <p className="min-w-0 flex-1 truncate text-sm">{caster.userDisplayName}</p>
            <span className="shrink-0 text-xs tabular-nums">
              {caster.totalUp > 0 && (
                <span className="text-green-400">+{caster.totalUp}</span>
              )}
              {caster.totalUp > 0 && caster.totalDown > 0 && (
                <span className="text-stitch-muted"> / </span>
              )}
              {caster.totalDown > 0 && (
                <span className="text-red-400">−{caster.totalDown}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** «Кто голосовал»: paginated cast feed + top casters (community members only). */
export function PollCastFeed({ pollId }: { pollId: string }) {
  const [extraPages, setExtraPages] = useState(0);
  const firstQuery = trpc.polls.getCasts.useQuery({
    pollId,
    skip: 0,
    limit: PAGE_SIZE,
  });

  const firstItems = (firstQuery.data?.items ?? []) as CastRow[];
  const casters = (firstQuery.data?.casters ?? []) as CasterRow[];
  const total = firstQuery.data?.total ?? 0;
  const loadedCount = PAGE_SIZE * (1 + extraPages);

  if (firstQuery.isError) {
    return null;
  }

  return (
    <section className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-4">
      <h2 className="font-semibold">Кто голосовал</h2>

      {firstQuery.isLoading && (
        <p className="text-sm text-stitch-muted">Загрузка…</p>
      )}

      {!firstQuery.isLoading && total === 0 && (
        <p className="text-sm text-stitch-muted">Пока никто не голосовал.</p>
      )}

      {total > 0 && (
        <>
          <ul className="divide-y divide-stitch-border">
            {firstItems.map((cast) => (
              <CastFeedRow key={cast.id} cast={cast} />
            ))}
            {Array.from({ length: extraPages }, (_, i) => (
              <CastRowsPage key={i + 1} pollId={pollId} skip={PAGE_SIZE * (i + 1)} />
            ))}
          </ul>
          {loadedCount < total && (
            <button
              type="button"
              onClick={() => setExtraPages((p) => p + 1)}
              className="text-sm text-primary hover:underline"
            >
              Загрузить ещё
            </button>
          )}
          <TopCasters casters={casters} />
        </>
      )}
    </section>
  );
}
