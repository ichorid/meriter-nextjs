'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FutureVisionFeed } from '@/components/organisms/FutureVision/FutureVisionFeed';
import { CommunityHeroCard } from '@/components/organisms/Community/CommunityHeroCard';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout/AdaptiveLayout';
import { useCommunities } from '@/hooks/api';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { useUserQuota } from '@/hooks/api/useQuota';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { QuotaDisplay } from '@/components/molecules/QuotaDisplay/QuotaDisplay';
import { EarnMeritsBirzhaButton } from '@/components/molecules/EarnMeritsBirzhaButton/EarnMeritsBirzhaButton';
import { BirzhaTappalkaModal } from '@/components/molecules/BirzhaTappalkaModal/BirzhaTappalkaModal';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { trpc } from '@/lib/trpc/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useCommunity } from '@/hooks/api/useCommunities';
import { useWallets } from '@/hooks/api/useWallet';
import { useBirzhaCommunityId } from '@/hooks/useBirzhaCommunityId';

export default function FutureVisionsPageClient() {
  const t = useTranslations('common');
  const { user } = useAuth();
  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const birzhaCommunityId = useBirzhaCommunityId();
  const [birzhaEarnModalOpen, setBirzhaEarnModalOpen] = useState(false);

  const { data: communitiesData } = useCommunities();
  const futureVisionCommunityId = useMemo(() => {
    const data = communitiesData?.data as Array<{ id: string; typeTag?: string }> | undefined;
    return data?.find((c) => c.typeTag === 'future-vision')?.id ?? null;
  }, [communitiesData?.data]);
  const { data: futureVisionCommunity } = useCommunity(futureVisionCommunityId ?? '');

  const canManageFutureVision = useMemo(() => {
    if (!futureVisionCommunityId || !user) return false;
    if (user.globalRole === 'superadmin') return true;
    const role = userRoles.find((r) => r.communityId === futureVisionCommunityId);
    return role?.role === 'lead';
  }, [futureVisionCommunityId, user, userRoles]);

  const ensureBaseCommunitiesMutation = trpc.users.ensureBaseCommunities.useMutation();
  useEffect(() => {
    void ensureBaseCommunitiesMutation.mutateAsync().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: balance = 0 } = useWalletBalance(GLOBAL_COMMUNITY_ID);
  const { data: wallets = [] } = useWallets();
  const { data: quotaData } = useUserQuota(futureVisionCommunityId ?? GLOBAL_COMMUNITY_ID);
  const quotaRemaining = quotaData?.remainingToday ?? 0;
  const quotaMax = quotaData?.dailyQuota ?? 0;
  const hasQuota = quotaMax > 0;

  return (
    <AdaptiveLayout
      communityId={futureVisionCommunityId ?? undefined}
      balance={balance}
      wallets={Array.isArray(wallets) ? wallets : []}
      myId={user?.id}
      stickyHeader={
        futureVisionCommunityId ? (
          <SimpleStickyHeader
            title={t('futureVisions', { defaultValue: 'Future Visions' })}
            showBack={false}
            asStickyHeader={true}
            showScrollToTop={true}
            rightAction={
              <div className="flex items-center gap-2 flex-shrink-0">
                <QuotaDisplay
                  balance={balance}
                  quotaRemaining={hasQuota ? quotaRemaining : undefined}
                  quotaMax={hasQuota ? quotaMax : undefined}
                  currencyIconUrl={undefined}
                  isMarathonOfGood={false}
                  showPermanent={true}
                  showDaily={hasQuota}
                  compact={true}
                  className="mr-2 -ml-[15px] mt-[5px]"
                  onEarnMeritsClick={
                    birzhaCommunityId ? () => setBirzhaEarnModalOpen(true) : undefined
                  }
                />
                <EarnMeritsBirzhaButton />
              </div>
            }
          />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4 p-4">
        {futureVisionCommunity && (
          <CommunityHeroCard
            community={{
              id: futureVisionCommunity.id,
              name: futureVisionCommunity.name,
              description: futureVisionCommunity.description,
              avatarUrl: futureVisionCommunity.avatarUrl,
              coverImageUrl: futureVisionCommunity.coverImageUrl,
              typeTag: futureVisionCommunity.typeTag,
              isAdmin: canManageFutureVision,
              needsSetup: futureVisionCommunity.needsSetup,
              settings: { iconUrl: futureVisionCommunity.settings?.iconUrl },
              futureVisionCover: futureVisionCommunity.futureVisionCover,
              futureVisionText: futureVisionCommunity.futureVisionText,
              futureVisionTags: futureVisionCommunity.futureVisionTags,
            }}
          />
        )}
        <FutureVisionFeed />
      </div>

      <BirzhaTappalkaModal
        open={birzhaEarnModalOpen}
        onOpenChange={setBirzhaEarnModalOpen}
        communityId={birzhaCommunityId}
      />
    </AdaptiveLayout>
  );
}
