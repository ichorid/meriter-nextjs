'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AuthGate } from '@/components/shell';
import { CommunityShell } from '@/components/community-shell';
import { PollCastFeed } from '@/components/polls/poll-cast-feed';
import { PollCastPanel } from '@/components/polls/poll-cast-panel';
import { PollCountdown } from '@/components/polls/poll-countdown';
import { isPollFinished, type PollView } from '@/components/polls/poll-types';
import { useCommunityId } from '@/lib/use-route-params';
import { trpc } from '@/lib/trpc/client';
import { useTelegramBackButton } from '@/lib/use-telegram-chrome';

function PollDetailInner({
  communityId,
  pollId,
}: {
  communityId: string;
  pollId: string;
}) {
  const router = useRouter();
  const pollQuery = trpc.polls.getById.useQuery({ id: pollId });
  const poll = pollQuery.data as PollView | undefined;

  const backButtonActive = useTelegramBackButton({
    visible: true,
    onClick: () => router.push(`/c/${communityId}/polls`),
  });

  return (
    <CommunityShell communityId={communityId} active="polls" tgActive="polls">
      <div className="space-y-6">
        {!backButtonActive && (
          <Link
            href={`/c/${communityId}/polls`}
            className="text-sm text-primary hover:underline"
          >
            ← Голосования
          </Link>
        )}

        {pollQuery.isLoading && (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        )}

        {pollQuery.isError && (
          <p className="text-sm text-red-400">Голосование не найдено.</p>
        )}

        {poll && (
          <>
            <header className="space-y-2">
              <h1 className="text-xl font-extrabold tracking-tight">{poll.question}</h1>
              {poll.description && (
                <p className="whitespace-pre-wrap text-sm text-stitch-muted">
                  {poll.description}
                </p>
              )}
              <p className="text-xs">
                {isPollFinished(poll) ? (
                  <span className="text-stitch-muted">
                    Завершено {new Date(poll.expiresAt).toLocaleString('ru-RU')}
                  </span>
                ) : (
                  <PollCountdown expiresAt={poll.expiresAt} />
                )}
                {(poll.metrics?.casterCount ?? 0) > 0 && (
                  <span className="text-stitch-muted">
                    {' · Участников: '}
                    {poll.metrics?.casterCount}
                  </span>
                )}
              </p>
            </header>

            <PollCastPanel poll={poll} communityId={communityId} />

            <PollCastFeed pollId={poll.id} />
          </>
        )}
      </div>
    </CommunityShell>
  );
}

export default function PollDetailPage() {
  const communityId = useCommunityId();
  const params = useParams<{ pollId: string }>();

  return (
    <AuthGate>
      <PollDetailInner communityId={communityId} pollId={params.pollId} />
    </AuthGate>
  );
}
