'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { WalletChip } from '@/components/wallet-chip';
import { CommunityBottomNavTg } from '@/components/community-bottom-nav-tg';
import { TgFrozenBanner, useIsCommunityFrozen } from '@/components/tg-frozen-banner';
import { TruncatedLabel } from '@/components/truncated-label';
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
  const [communitySwitcherReady, setCommunitySwitcherReady] = useState(false);
  useEffect(() => {
    setCommunitySwitcherReady(true);
  }, []);

  const communityQuery = trpc.communities.getById.useQuery({ id: communityId });
  const walletQuery = trpc.wallets.getByCommunity.useQuery({
    userId: 'me',
    communityId,
  });
  const quotaQuery = trpc.wallets.getQuota.useQuery({
    userId: 'me',
    communityId,
  });
  const communitiesQuery = trpc.communities.listForTelegramUser.useQuery(undefined, {
    staleTime: 60_000,
    enabled: communitySwitcherReady,
  });
  const isFrozen = useIsCommunityFrozen();

  const tabs = buildTgCommunityTabs(communityId);
  const wallet = walletQuery.data?.balance ?? 0;
  const quotaRemaining = quotaQuery.data?.remaining ?? 0;
  const quotaMax = quotaQuery.data?.dailyQuota ?? 0;
  const communityName = communityQuery.data?.name ?? 'Meriter';
  const showCommunitySwitcher = (communitiesQuery.data?.length ?? 0) > 1;

  return (
    <div className="min-h-screen bg-stitch-canvas">
      <header className="sticky top-0 z-10 border-b border-stitch-border bg-stitch-sidebar/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {showCommunitySwitcher && (
              <Link
                href="/tg/pick"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stitch-muted transition-colors hover:bg-stitch-surface hover:text-stitch-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Выбрать другое сообщество"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </Link>
            )}
            <TruncatedLabel
              text={communityName}
              className="min-w-0 flex-1 font-extrabold tracking-tight text-stitch-text"
            />
          </div>
          <div className="shrink-0">
            <WalletChip
              communityId={communityId}
              wallet={wallet}
              quotaRemaining={quotaRemaining}
              quotaMax={quotaMax}
            />
          </div>
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
