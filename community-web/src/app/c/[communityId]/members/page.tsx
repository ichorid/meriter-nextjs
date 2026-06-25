'use client';

import { AuthGate, Shell } from '@/components/shell';
import { useCommunityId } from '@/lib/use-route-params';
import { trpc } from '@/lib/trpc/client';

function roleLabel(role: string | undefined): string {
  if (role === 'lead') return 'Лид';
  if (role === 'superadmin') return 'Суперадмин';
  return 'Участник';
}

function MembersInner({ communityId }: { communityId: string }) {
  const membersQuery = trpc.communities.getMembers.useQuery(
    { id: communityId, pageSize: 50 },
    { enabled: Boolean(communityId) },
  );

  const members = membersQuery.data?.data ?? [];
  const total = membersQuery.data?.pagination?.total ?? 0;

  return (
    <Shell communityId={communityId} active="members">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Пользователи</h1>
          <p className="mt-1 text-sm text-stitch-muted">
            Участники сообщества, роли и балансы заслуг (только просмотр).
          </p>
        </div>

        {membersQuery.isLoading && (
          <p className="text-sm text-stitch-muted">Загрузка…</p>
        )}

        {membersQuery.isError && (
          <p className="text-sm text-red-400">Не удалось загрузить список участников.</p>
        )}

        {!membersQuery.isLoading && total < 3 && (
          <p className="rounded-xl border border-stitch-border bg-stitch-surface px-4 py-3 text-sm text-stitch-muted">
            Мало участников для демо. Запустите{' '}
            <code className="text-xs">pnpm seed:community-web-dev</code> или пересоздайте
            демо-данные в настройках (лид, dev-режим).
          </p>
        )}

        <ul className="space-y-3">
          {members.map((member) => (
            <li
              key={member.id}
              className="rounded-xl border border-stitch-border bg-stitch-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-stitch-text">
                    {member.displayName || member.username || member.id}
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
                  <p className="text-xs text-stitch-muted">Квота сегодня</p>
                  <p className="font-medium">
                    {member.quota?.remainingToday ?? 0} / {member.quota?.dailyQuota ?? 0}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {!membersQuery.isLoading && members.length === 0 && (
          <p className="text-sm text-stitch-muted">Участников пока нет.</p>
        )}
      </div>
    </Shell>
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
