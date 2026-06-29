'use client';

import { AuthGate } from '@/components/shell';
import { CommunityShell } from '@/components/community-shell';
import { MemberTransferInline } from '@/components/member-transfer-inline';
import { useCommunityId } from '@/lib/use-route-params';
import { useTelegramMiniApp } from '@/lib/telegram-mini-app-context';
import { trpc } from '@/lib/trpc/client';

function memberQuotaMax(quota: {
  dailyEmission?: number;
  dailyQuota?: number;
  usedToday?: number;
  remainingToday?: number;
} | null | undefined): number {
  if (!quota) return 0;
  if (typeof quota.dailyEmission === 'number' && quota.dailyEmission > 0) {
    return quota.dailyEmission;
  }
  if (typeof quota.dailyQuota === 'number' && quota.dailyQuota > 0) {
    return quota.dailyQuota;
  }
  return (quota.remainingToday ?? 0) + (quota.usedToday ?? 0);
}

function roleLabel(role: string | undefined): string {
  if (role === 'lead') return 'Лид';
  if (role === 'superadmin') return 'Суперадмин';
  return 'Участник';
}

function MembersInner({ communityId }: { communityId: string }) {
  const { isMiniApp } = useTelegramMiniApp();
  const meQuery = trpc.users.getMe.useQuery();
  const walletQuery = trpc.wallets.getByCommunity.useQuery({
    userId: 'me',
    communityId,
  });
  const membersQuery = trpc.communities.getMembers.useQuery(
    { id: communityId, pageSize: 50 },
    { enabled: Boolean(communityId) },
  );

  const members = [...(membersQuery.data?.data ?? [])].sort(
    (a, b) => (b.walletBalance ?? 0) - (a.walletBalance ?? 0),
  );
  const total = membersQuery.data?.pagination?.total ?? 0;
  const selfId = meQuery.data?.id;
  const walletBalance = walletQuery.data?.balance ?? 0;

  return (
    <CommunityShell communityId={communityId} active="members" tgActive="members">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Участники</h1>
          <p className="mt-1 text-sm text-stitch-muted">
            Рейтинг по балансу заслуг в сообществе.
          </p>
        </div>

        {membersQuery.isLoading && (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        )}

        {membersQuery.isError && (
          <p className="text-sm text-red-400">Не удалось загрузить список участников.</p>
        )}

        <ul className="space-y-3">
          {members.map((member) => {
            const isSelf = member.id === selfId;
            return (
              <li
                key={member.id}
                className={
                  isSelf
                    ? 'rounded-xl border border-primary/40 bg-primary/5 p-4'
                    : 'rounded-xl border border-stitch-border bg-stitch-surface p-4'
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-stitch-text">
                      {member.displayName || member.username || member.id}
                      {isSelf && (
                        <span className="ml-2 text-xs font-normal text-primary">(вы)</span>
                      )}
                    </p>
                    {member.username && (
                      <p className="text-sm text-stitch-muted">@{member.username}</p>
                    )}
                  </div>
                  <span className="rounded-lg bg-stitch-elevated px-2 py-0.5 text-xs font-medium text-stitch-muted">
                    {roleLabel(member.role)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-stitch-muted">Кошелёк</p>
                    <p className="font-medium">{member.walletBalance ?? 0} заслуг</p>
                  </div>
                  <div>
                    <p className="text-xs text-stitch-muted">Ежедневные</p>
                    <p className="font-medium">
                      {member.quota?.remainingToday ?? 0} / {memberQuotaMax(member.quota)}
                    </p>
                  </div>
                </div>
                {isMiniApp && !isSelf && (
                  <MemberTransferInline
                    communityId={communityId}
                    receiverId={member.id}
                    receiverLabel={
                      member.displayName || member.username || member.id
                    }
                    walletBalance={walletBalance}
                  />
                )}
              </li>
            );
          })}
        </ul>

        {!isMiniApp && !membersQuery.isLoading && total < 3 && (
          <p className="rounded-xl border border-stitch-border bg-stitch-surface px-4 py-3 text-sm text-stitch-muted">
            Мало участников для демо. Запустите{' '}
            <code className="text-xs">pnpm seed:community-web-dev</code> или пересоздайте
            демо-данные в настройках (лид, dev-режим).
          </p>
        )}

        {!membersQuery.isLoading && members.length === 0 && (
          <p className="text-sm text-stitch-muted">Участников пока нет.</p>
        )}
      </div>
    </CommunityShell>
  );
}

export default function MembersPage() {
  const communityId = useCommunityId();
  return (
    <AuthGate>
      <MembersInner communityId={communityId} />
    </AuthGate>
  );
}
