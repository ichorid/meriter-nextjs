'use client';

import { trpc } from '@/lib/trpc/client';

type CasterRow = {
  userId: string;
  userDisplayName: string;
  avatarUrl?: string;
  totalUp: number;
  totalDown: number;
};

function VoterAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="h-7 w-7 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stitch-canvas text-xs font-semibold text-stitch-muted">
      {name.slice(0, 1).toUpperCase() || '?'}
    </span>
  );
}

/** Aggregated voters for one poll option (net = up − down). */
export function PollOptionVoters({
  pollId,
  optionId,
}: {
  pollId: string;
  optionId: string;
}) {
  const query = trpc.polls.getCasts.useQuery({
    pollId,
    optionId,
    skip: 0,
    limit: 1,
  });

  const casters = (query.data?.casters ?? []) as CasterRow[];

  if (query.isLoading) {
    return (
      <div className="mt-2 rounded-lg bg-stitch-canvas/60 px-3 py-2">
        <p className="text-xs text-stitch-muted">Загрузка…</p>
      </div>
    );
  }

  if (query.isError) {
    return null;
  }

  return (
    <div className="mt-2 rounded-lg bg-stitch-canvas/60 px-3 py-2 space-y-1">
      <p className="text-xs font-semibold text-stitch-muted">Кто за этот вариант</p>
      {casters.length === 0 ? (
        <p className="text-xs text-stitch-muted">Пока никто не голосовал за этот вариант.</p>
      ) : (
        <ul className="divide-y divide-stitch-border/60">
          {casters.map((caster) => {
            const net = caster.totalUp - caster.totalDown;
            return (
              <li key={caster.userId} className="flex items-center gap-2 py-1.5">
                <VoterAvatar name={caster.userDisplayName} avatarUrl={caster.avatarUrl} />
                <p className="min-w-0 flex-1 truncate text-sm">{caster.userDisplayName}</p>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    net > 0
                      ? 'text-green-400'
                      : net < 0
                        ? 'text-red-400'
                        : 'text-stitch-muted'
                  }`}
                >
                  {net > 0 ? `+${net}` : net}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
