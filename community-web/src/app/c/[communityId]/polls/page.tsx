'use client';

import Link from 'next/link';
import { AuthGate } from '@/components/shell';
import { CommunityShell } from '@/components/community-shell';
import { PollListItem } from '@/components/polls/poll-list-item';
import { isPollFinished, type PollView } from '@/components/polls/poll-types';
import { useCommunityId } from '@/lib/use-route-params';
import { trpc } from '@/lib/trpc/client';

function PollsListInner({ communityId }: { communityId: string }) {
  const communityQuery = trpc.communities.getById.useQuery({ id: communityId });
  const pollsQuery = trpc.polls.listByCommunity.useQuery({
    communityId,
    pageSize: 100,
  });

  const polls = (pollsQuery.data?.data ?? []) as PollView[];
  const active = polls.filter((poll) => !isPollFinished(poll));
  const finished = polls.filter((poll) => isPollFinished(poll));

  const isLead = communityQuery.data?.isAdmin === true;
  const pollCreation = communityQuery.data?.settings?.pollCreation ?? 'members';
  const canCreate = pollCreation === 'members' || isLead;

  return (
    <CommunityShell communityId={communityId} active="polls" tgActive="polls">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold tracking-tight">Голосования</h1>
          {canCreate && (
            <Link
              href={`/c/${communityId}/polls/create`}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Создать
            </Link>
          )}
        </div>

        {pollsQuery.isLoading && (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        )}

        {pollsQuery.isError && (
          <p className="text-sm text-red-400">Не удалось загрузить голосования.</p>
        )}

        {!pollsQuery.isLoading && !pollsQuery.isError && (
          <>
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-stitch-muted">Идут сейчас</h2>
              <ul className="space-y-3">
                {active.map((poll) => (
                  <li key={poll.id}>
                    <PollListItem poll={poll} communityId={communityId} />
                  </li>
                ))}
              </ul>
              {active.length === 0 && (
                <p className="text-sm text-stitch-muted">Нет активных голосований.</p>
              )}
            </section>

            {finished.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-stitch-muted">Завершённые</h2>
                <ul className="space-y-3">
                  {finished.map((poll) => (
                    <li key={poll.id}>
                      <PollListItem poll={poll} communityId={communityId} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </CommunityShell>
  );
}

export default function PollsPage() {
  const communityId = useCommunityId();
  return (
    <AuthGate>
      <PollsListInner communityId={communityId} />
    </AuthGate>
  );
}
