'use client';

import { WalletChip } from '@/components/wallet-chip';
import { CommunityBottomNavTg } from '@/components/community-bottom-nav-tg';
import { TgFrozenBanner, useIsCommunityFrozen } from '@/components/tg-frozen-banner';
import { trpc } from '@/lib/trpc/client';
import { buildTgCommunityTabs, type TgCommunityTabId } from '@/lib/community-nav-tg';

export function TgShell({
  communityId,
  children,
  active,
}: {
  communityId: string;
  children: React.ReactNode;
  active: TgCommunityTabId;
}) {
  const communityQuery = trpc.communities.getById.useQuery({ id: communityId });
  const walletQuery = trpc.wallets.getByCommunity.useQuery({
    userId: 'me',
    communityId,
  });
  const quotaQuery = trpc.wallets.getQuota.useQuery({
    userId: 'me',
    communityId,
  });
  const isFrozen = useIsCommunityFrozen();

  const tabs = buildTgCommunityTabs(communityId);
  const wallet = walletQuery.data?.balance ?? 0;
  const quotaRemaining = quotaQuery.data?.remaining ?? 0;
  const quotaMax = quotaQuery.data?.dailyQuota ?? 0;

  return (
    <div className="min-h-screen bg-stitch-canvas">
      <header className="sticky top-0 z-10 border-b border-stitch-border bg-stitch-sidebar/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <span className="truncate font-extrabold tracking-tight text-stitch-text">
            {communityQuery.data?.name ?? 'Meriter'}
          </span>
          <WalletChip
            communityId={communityId}
            wallet={wallet}
            quotaRemaining={quotaRemaining}
            quotaMax={quotaMax}
          />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 pb-[calc(var(--shell-bottom-nav-height)+env(safe-area-inset-bottom)+1.5rem)]">
        <TgFrozenBanner />
        <div className={isFrozen ? 'pointer-events-none opacity-50' : undefined}>{children}</div>
      </main>
      <CommunityBottomNavTg tabs={tabs} activeId={active} />
    </div>
  );
}
