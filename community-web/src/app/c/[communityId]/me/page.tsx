'use client';

import Link from 'next/link';
import { AuthGate } from '@/components/shell';
import { MeritHistoryRow } from '@/components/merit-history-row';
import { CommunityShell } from '@/components/community-shell';
import { useCommunityId } from '@/lib/use-route-params';
import { trpc } from '@/lib/trpc/client';

function MePageInner({ communityId }: { communityId: string }) {
  const meQuery = trpc.users.getMe.useQuery();
  const walletQuery = trpc.wallets.getByCommunity.useQuery({
    userId: 'me',
    communityId,
  });
  const quotaQuery = trpc.wallets.getQuota.useQuery({
    userId: 'me',
    communityId,
  });
  const membersQuery = trpc.communities.getMembers.useQuery(
    { id: communityId, pageSize: 100 },
    { enabled: Boolean(communityId) },
  );
  const txQuery = trpc.wallets.getTransactions.useQuery(
    {
      userId: 'me',
      page: 1,
      pageSize: 10,
      communityId,
      permissionCommunityId: communityId,
    },
    { enabled: Boolean(meQuery.data?.id) },
  );

  const wallet = walletQuery.data?.balance ?? 0;
  const quotaRemaining = quotaQuery.data?.remaining ?? 0;
  const quotaMax = quotaQuery.data?.dailyQuota ?? 0;
  const quotaPct = quotaMax > 0 ? Math.round((quotaRemaining / quotaMax) * 100) : 0;

  const members = membersQuery.data?.data ?? [];
  const memberTotal = membersQuery.data?.pagination?.total ?? members.length;
  const totalWallet = members.reduce((sum, m) => sum + (m.walletBalance ?? 0), 0);
  const poolPct =
    totalWallet > 0 && meQuery.data?.id
      ? (
          ((members.find((m) => m.id === meQuery.data?.id)?.walletBalance ?? wallet) /
            totalWallet) *
          100
        ).toFixed(1)
      : '0';

  const txs = txQuery.data?.data ?? [];

  return (
    <CommunityShell communityId={communityId} active="settings" tgActive="me">
      <div className="space-y-6">
        <h1 className="text-xl font-extrabold tracking-tight">Мои заслуги</h1>
        <p className="text-sm text-stitch-muted">Участников в сообществе: {memberTotal}</p>

        <div className="rounded-xl border border-stitch-border bg-stitch-surface p-5 space-y-4">
          <div>
            <p className="text-xs text-stitch-muted">Кошелёк</p>
            <p className="text-3xl font-extrabold text-primary tabular-nums">{wallet}</p>
            <p className="text-sm text-stitch-muted">заслуг</p>
          </div>
          <div>
            <p className="text-xs text-stitch-muted">Ежедневные заслуги</p>
            <p className="text-lg font-semibold tabular-nums">
              {quotaRemaining} / {quotaMax}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-stitch-canvas">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${quotaPct}%` }}
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-stitch-muted">Доля в пуле сообщества</p>
            <p className="text-lg font-semibold">{poolPct}%</p>
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Последние операции</h2>
            <Link
              href={`/c/${communityId}/merit-history`}
              className="text-sm text-primary hover:underline"
            >
              Все
            </Link>
          </div>
          {txQuery.isLoading && <p className="text-sm text-stitch-muted">Загрузка…</p>}
          <ul className="space-y-2">
            {txs.map((tx) => (
              <MeritHistoryRow
                key={tx.id}
                row={{
                  id: tx.id,
                  type: tx.type,
                  amount: tx.amount,
                  description: tx.description,
                  referenceType: tx.referenceType,
                  createdAt: tx.createdAt,
                  ledgerMultiplier: tx.ledgerMultiplier,
                  meritHistoryEnrichment: tx.meritHistoryEnrichment,
                }}
              />
            ))}
          </ul>
          {!txQuery.isLoading && txs.length === 0 && (
            <p className="text-sm text-stitch-muted">Операций пока нет.</p>
          )}
        </section>
      </div>
    </CommunityShell>
  );
}

export default function MePage() {
  const communityId = useCommunityId();
  return (
    <AuthGate>
      <MePageInner communityId={communityId} />
    </AuthGate>
  );
}
