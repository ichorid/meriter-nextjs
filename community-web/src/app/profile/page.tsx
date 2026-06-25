'use client';

import { AuthGate } from '@/components/shell';
import { trpc } from '@/lib/trpc/client';

export default function ProfilePage() {
  const meQuery = trpc.users.getMe.useQuery();
  const resolveQuery = trpc.communities.resolveForTelegramUser.useQuery(undefined, {
    enabled: !!meQuery.data,
  });
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = '/login';
    },
  });

  const communityId = resolveQuery.data?.communityId;
  const walletQuery = trpc.wallets.getByCommunity.useQuery(
    { communityId: communityId ?? '' },
    { enabled: !!communityId },
  );
  const quotaQuery = trpc.wallets.getQuota.useQuery(
    { communityId: communityId ?? '' },
    { enabled: !!communityId },
  );

  return (
    <AuthGate>
      <div className="mx-auto max-w-md space-y-6 px-4 py-10">
        <h1 className="text-2xl font-extrabold tracking-tight">Профиль</h1>
        {meQuery.data && (
          <div className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-1">
            <p className="font-medium">{meQuery.data.displayName}</p>
            <p className="text-sm text-stitch-muted">@{meQuery.data.username}</p>
          </div>
        )}
        {communityId && (
          <div className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-2">
            <p className="text-sm text-stitch-muted">Сообщество</p>
            <p className="font-medium">{resolveQuery.data?.name}</p>
            <p className="text-sm">
              Кошелёк: <strong>{walletQuery.data?.balance ?? '…'}</strong> заслуг
            </p>
            <p className="text-sm">
              Квота сегодня:{' '}
              <strong>{quotaQuery.data?.remaining ?? '…'}</strong> /{' '}
              {quotaQuery.data?.dailyQuota ?? '…'}
            </p>
            <a
              href={`/c/${communityId}/feed`}
              className="inline-block text-sm text-primary hover:underline"
            >
              Перейти в ленту →
            </a>
          </div>
        )}
        <button
          type="button"
          onClick={() => logout.mutate()}
          className="rounded-lg border border-stitch-border px-4 py-2 text-sm hover:bg-stitch-surface"
        >
          Выйти
        </button>
      </div>
    </AuthGate>
  );
}
