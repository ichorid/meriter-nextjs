'use client';

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { WalletChip } from '@/components/wallet-chip';
import { CommunityBottomNavTg } from '@/components/community-bottom-nav-tg';
import { TgMoreSheet } from '@/components/tg-more-sheet';
import { TgFrozenBanner, useIsCommunityFrozen } from '@/components/tg-frozen-banner';
import { trpc } from '@/lib/trpc/client';
import {
  buildTgCommunityTabs,
  buildTgMoreTabs,
  type TgCommunityTabId,
} from '@/lib/community-nav-tg';

export function TgShell({
  communityId,
  children,
  active,
}: {
  communityId: string;
  children: React.ReactNode;
  active: TgCommunityTabId;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const meQuery = trpc.users.getMe.useQuery();
  const communityQuery = trpc.communities.getById.useQuery({ id: communityId });
  const walletQuery = trpc.wallets.getByCommunity.useQuery({ communityId });
  const quotaQuery = trpc.wallets.getQuota.useQuery({ communityId });

  const isLead =
    communityQuery.data?.isAdmin === true ||
    (meQuery.data?.id != null &&
      (communityQuery.data?.adminIds ?? []).includes(meQuery.data.id));

  const moderationEnabled =
    communityQuery.data?.settings?.telegramModerationEnabled === true;

  const tabs = buildTgCommunityTabs(communityId);
  const moreTabs = buildTgMoreTabs(communityId, { isLead, moderationEnabled });

  const pendingQuery = trpc.publications.listPendingTelegramModeration.useQuery(
    { communityId },
    { enabled: moderationEnabled && isLead },
  );
  const moderationPendingCount = pendingQuery.data?.length ?? 0;
  const isFrozen = useIsCommunityFrozen();

  const wallet = walletQuery.data?.balance ?? 0;
  const quotaRemaining = quotaQuery.data?.remainingToday ?? 0;
  const quotaMax = quotaQuery.data?.dailyQuota ?? 0;

  return (
    <div className="min-h-screen bg-stitch-canvas">
      <header className="sticky top-0 z-10 border-b border-stitch-border bg-stitch-sidebar/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <span className="truncate font-extrabold tracking-tight text-stitch-text">
            {communityQuery.data?.name ?? 'Meriter'}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <WalletChip
              communityId={communityId}
              wallet={wallet}
              quotaRemaining={quotaRemaining}
              quotaMax={quotaMax}
            />
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-stitch-muted hover:bg-stitch-surface"
              aria-label="Ещё"
            >
              <MoreHorizontal className="h-5 w-5" />
              {moderationPendingCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 pb-[calc(var(--shell-bottom-nav-height)+env(safe-area-inset-bottom)+1.5rem)]">
        <TgFrozenBanner />
        <div className={isFrozen ? 'pointer-events-none opacity-50' : undefined}>{children}</div>
      </main>
      <CommunityBottomNavTg tabs={tabs} activeId={active} />
      <TgMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        tabs={moreTabs}
        moderationPendingCount={moderationPendingCount}
      />
    </div>
  );
}
