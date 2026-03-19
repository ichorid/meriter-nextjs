'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FutureVisionFeed } from '@/components/organisms/FutureVision/FutureVisionFeed';
import { CommunityHeroCard } from '@/components/organisms/Community/CommunityHeroCard';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout/AdaptiveLayout';
import { useCommunities } from '@/hooks/api';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { useUserQuota } from '@/hooks/api/useQuota';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { QuotaDisplay } from '@/components/molecules/QuotaDisplay/QuotaDisplay';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/shadcn/dialog';
import { TappalkaScreen } from '@/features/tappalka';
import { routes } from '@/lib/constants/routes';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { trpc } from '@/lib/trpc/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useCommunity } from '@/hooks/api/useCommunities';

export default function FutureVisionsPageClient() {
  const t = useTranslations('common');
  const tCommunities = useTranslations('pages.communities');
  const router = useRouter();
  const [showTappalkaModal, setShowTappalkaModal] = useState(false);
  const { user } = useAuth();
  const { data: userRoles = [] } = useUserRoles(user?.id || '');

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
    // Fix legacy accounts missing roles in priority communities (Future Vision voting relies on it).
    void ensureBaseCommunitiesMutation.mutateAsync().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: balance = 0 } = useWalletBalance(GLOBAL_COMMUNITY_ID);
  const { data: quotaData } = useUserQuota(futureVisionCommunityId ?? GLOBAL_COMMUNITY_ID);
  const quotaRemaining = quotaData?.remainingToday ?? 0;
  const quotaMax = quotaData?.dailyQuota ?? 0;
  const hasQuota = quotaMax > 0;

  return (
    <AdaptiveLayout
      communityId={futureVisionCommunityId ?? undefined}
      stickyHeader={
        futureVisionCommunityId ? (
          <SimpleStickyHeader
            title={t('futureVisions', { defaultValue: 'Future Visions' })}
            showBack={true}
            onBack={() => router.push(routes.communities)}
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
                  onEarnMeritsClick={() => setShowTappalkaModal(true)}
                />
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
        <FutureVisionFeed
          onEarnMeritsClick={() => setShowTappalkaModal(true)}
          tappalkaEnabled={!!futureVisionCommunityId}
        />
      </div>

      {/* Tappalka Modal */}
      {futureVisionCommunityId && (
        <>
          <Dialog open={showTappalkaModal} onOpenChange={setShowTappalkaModal}>
            <DialogContent
              className="max-w-4xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto p-0 bg-base-200 sm:rounded-lg"
              onInteractOutside={(e) => {
                e.preventDefault();
              }}
            >
              <DialogTitle className="sr-only">
                {tCommunities('tappalka')}
              </DialogTitle>
              <TappalkaScreen
                communityId={futureVisionCommunityId}
                onClose={() => setShowTappalkaModal(false)}
              />
            </DialogContent>
          </Dialog>
          {showTappalkaModal && (
            <style
              dangerouslySetInnerHTML={{
                __html: `
                  [data-radix-dialog-overlay][data-state="open"] {
                    background-color: rgba(0, 0, 0, 0.4) !important;
                  }
                `,
              }}
            />
          )}
        </>
      )}
    </AdaptiveLayout>
  );
}
