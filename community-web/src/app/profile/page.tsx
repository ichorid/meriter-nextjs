'use client';

import Link from 'next/link';
import { AuthGate } from '@/components/shell';
import { trpc } from '@/lib/trpc/client';

export default function ProfilePage() {
  const meQuery = trpc.users.getMe.useQuery();
  const configQuery = trpc.config.getConfig.useQuery();
  const resolveQuery = trpc.communities.resolveForTelegramUser.useQuery(undefined, {
    enabled: !!meQuery.data,
  });
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = '/login';
    },
  });

  const communityId =
    resolveQuery.data?.communityId ?? configQuery.data?.devCommunityId ?? null;
  const communityName =
    resolveQuery.data?.name ??
    (communityId && configQuery.data?.devCommunityId === communityId
      ? 'Dev Telegram Community'
      : undefined);

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
      <div className="min-h-screen bg-stitch-canvas">
        <header className="sticky top-0 z-10 border-b border-stitch-border bg-stitch-sidebar/95 backdrop-blur pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
            <Link
              href={communityId ? `/c/${communityId}/feed` : '/login'}
              className="text-sm text-stitch-muted hover:text-primary"
            >
              ← Meriter
            </Link>
            <h1 className="text-lg font-extrabold tracking-tight">Профиль</h1>
          </div>
        </header>

        <div className="mx-auto max-w-md space-y-6 px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {meQuery.data && (
            <div className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-1">
              <p className="font-medium">{meQuery.data.displayName}</p>
              <p className="text-sm text-stitch-muted">@{meQuery.data.username}</p>
            </div>
          )}
          {communityId && (
            <div className="rounded-xl border border-stitch-border bg-stitch-surface p-4 space-y-2">
              <p className="text-sm text-stitch-muted">Сообщество</p>
              <p className="font-medium">{communityName ?? communityId}</p>
              <p className="text-sm">
                Кошелёк: <strong>{walletQuery.data?.balance ?? '…'}</strong> заслуг
              </p>
              <p className="text-sm">
                Квота сегодня:{' '}
                <strong>{quotaQuery.data?.remaining ?? '…'}</strong> /{' '}
                {quotaQuery.data?.dailyQuota ?? '…'}
              </p>
              <Link
                href={`/c/${communityId}/feed`}
                className="inline-block text-sm text-primary hover:underline"
              >
                Перейти в ленту →
              </Link>
            </div>
          )}
          {!communityId && resolveQuery.isSuccess && (
            <p className="text-sm text-stitch-muted">
              Сообщество не найдено. Запустите{' '}
              <code className="text-xs">pnpm seed:community-web-dev</code> или включите{' '}
              <code className="text-xs">COMMUNITY_WEB_DEV_AUTO_SEED=true</code> в API.
            </p>
          )}
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="min-h-[44px] w-full rounded-lg border border-stitch-border px-4 py-2 text-sm hover:bg-stitch-surface"
          >
            Выйти
          </button>
        </div>
      </div>
    </AuthGate>
  );
}
