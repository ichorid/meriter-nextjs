'use client';

import { AuthGate, Shell } from '@/components/shell';
import { trpc } from '@/lib/trpc/client';

function MeritHistoryInner({ communityId }: { communityId: string }) {
  const historyQuery = trpc.wallets.getCommunityMeritHistory.useQuery({
    communityId,
    page: 1,
    pageSize: 30,
  });
  const personalQuery = trpc.wallets.getTransactions.useQuery({
    page: 1,
    pageSize: 20,
    permissionCommunityId: communityId,
  });

  return (
    <Shell communityId={communityId} active="merit-history">
      <div className="space-y-8">
        <section className="space-y-3">
          <h1 className="text-xl font-extrabold tracking-tight">История заслуг</h1>
          <h2 className="text-sm font-semibold text-stitch-muted">Сообщество (сводка)</h2>
          <ul className="space-y-2">
            {(historyQuery.data?.items ?? []).map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-stitch-border bg-stitch-surface px-3 py-2 text-sm"
              >
                <span className={row.amount >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {row.amount > 0 ? '+' : ''}
                  {row.amount}
                </span>{' '}
                {row.description ?? row.category}
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-stitch-muted">Личные операции</h2>
          <ul className="space-y-2">
            {(personalQuery.data?.items ?? []).map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-stitch-border bg-stitch-surface px-3 py-2 text-sm"
              >
                {row.description ?? row.type}: {row.amount}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}

export default function MeritHistoryPage({
  params,
}: {
  params: { communityId: string };
}) {
  return (
    <AuthGate>
      <MeritHistoryInner communityId={params.communityId} />
    </AuthGate>
  );
}
