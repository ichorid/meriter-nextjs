'use client';

import Link from 'next/link';
import { PollCountdown } from './poll-countdown';
import {
  isPollFinished,
  leadingOption,
  optionNet,
  type PollView,
} from './poll-types';

export function PollListItem({
  poll,
  communityId,
}: {
  poll: PollView;
  communityId: string;
}) {
  const finished = isPollFinished(poll);
  const leader = leadingOption(poll.options);
  const casterCount = poll.metrics?.casterCount ?? 0;

  return (
    <Link
      href={`/c/${communityId}/polls/${poll.id}`}
      className={`block rounded-xl border border-stitch-border bg-stitch-surface p-4 transition-colors hover:border-primary/50 ${
        finished ? 'opacity-80' : ''
      }`}
    >
      <p className="font-semibold">{poll.question}</p>
      {poll.description && (
        <p className="mt-1 line-clamp-2 text-sm text-stitch-muted">{poll.description}</p>
      )}
      <p className="mt-2 text-xs">
        {finished ? (
          <span className="text-stitch-muted">
            Завершено
            {leader && optionNet(leader) !== 0 && (
              <>
                {' · Лидирует «'}
                {leader.text}
                {'» ('}
                <span className={optionNet(leader) > 0 ? 'text-green-400' : 'text-red-400'}>
                  {optionNet(leader) > 0 ? '+' : ''}
                  {optionNet(leader)}
                </span>
                {')'}
              </>
            )}
          </span>
        ) : (
          <PollCountdown expiresAt={poll.expiresAt} />
        )}
        <span className="text-stitch-muted">
          {' · Вариантов: '}
          {poll.options.length}
          {casterCount > 0 && ` · Участников: ${casterCount}`}
        </span>
      </p>
    </Link>
  );
}
