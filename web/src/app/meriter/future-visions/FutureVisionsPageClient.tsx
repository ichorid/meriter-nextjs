'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FutureVisionFeed } from '@/components/organisms/FutureVision/FutureVisionFeed';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout/AdaptiveLayout';
import { useCommunities } from '@/hooks/api';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { CommunityTopBar } from '@/components/organisms/ContextTopBar';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/shadcn/dialog';
import { TappalkaScreen } from '@/features/tappalka';

export default function FutureVisionsPageClient() {
  const t = useTranslations('common');
  const tCommunities = useTranslations('pages.communities');
  const [showTappalkaModal, setShowTappalkaModal] = useState(false);

  const { data: communitiesData } = useCommunities();
  const futureVisionCommunityId = useMemo(() => {
    const data = communitiesData?.data as Array<{ id: string; typeTag?: string }> | undefined;
    return data?.find((c) => c.typeTag === 'future-vision')?.id ?? null;
  }, [communitiesData?.data]);

  const { data: balanceData } = useWalletBalance(futureVisionCommunityId ?? undefined);
  const balance = balanceData?.balance ?? 0;

  return (
    <AdaptiveLayout
      communityId={futureVisionCommunityId ?? undefined}
      stickyHeader={
        futureVisionCommunityId ? (
          <CommunityTopBar
            communityId={futureVisionCommunityId}
            asStickyHeader={true}
            showQuotaInHeader={true}
            quotaData={{
              balance,
              showPermanent: true,
              showDaily: false,
            }}
            tappalkaEnabled={true}
            onTappalkaClick={() => setShowTappalkaModal(true)}
          />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-2xl font-semibold">
          {t('futureVisions', { defaultValue: 'Future Visions' })}
        </h1>
        <FutureVisionFeed />
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
