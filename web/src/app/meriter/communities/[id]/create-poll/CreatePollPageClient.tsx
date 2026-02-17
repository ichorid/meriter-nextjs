'use client';

import React, { useEffect } from 'react';
import { FormPollCreate } from '@/features/polls/components/form-poll-create';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCommunity } from '@/hooks/api/useCommunities';
import { useWallet } from '@/hooks/api/useWallet';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { Dialog, DialogContent } from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Loader2 } from 'lucide-react';

interface CreatePollPageClientProps {
  communityId: string;
}

export function CreatePollPageClient({ communityId }: CreatePollPageClientProps) {
  const router = useRouter();
  const t = useTranslations('polls');
  const tCreate = useTranslations('publications.create');
  const tCommunities = useTranslations('pages.communities');
  const { isAuthenticated, isLoading: userLoading } = useAuth();
  const { data: community } = useCommunity(communityId);
  const { data: feeWallet } = useWallet(GLOBAL_COMMUNITY_ID);

  const pollCost = community?.settings?.pollCost ?? 1;
  const requiresPayment = community?.typeTag !== 'future-vision' && pollCost > 0;
  const walletBalance = feeWallet?.balance ?? 0;
  const hasInsufficientPayment = requiresPayment && walletBalance < pollCost;

  useEffect(() => {
    if (!userLoading && !isAuthenticated) {
      router.push(`/meriter/login?returnTo=${encodeURIComponent(`/meriter/communities/${communityId}/create-poll`)}`);
    }
  }, [isAuthenticated, userLoading, router, communityId]);

  if (!isAuthenticated || !communityId) {
    return null;
  }

  const dataReady = community !== undefined && feeWallet !== undefined;
  if (!dataReady) {
    return (
      <AdaptiveLayout communityId={communityId}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-base-content/50" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (hasInsufficientPayment) {
    return (
      <AdaptiveLayout
        communityId={communityId}
        stickyHeader={
          <SimpleStickyHeader
            title={t('createTitle')}
            showBack={true}
            onBack={() => router.push(`/meriter/communities/${communityId}`)}
            asStickyHeader={true}
          />
        }
      >
        <Dialog open={true}>
          <DialogContent
            className="max-w-sm"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={() => router.push(`/meriter/communities/${communityId}`)}
          >
            <p className="text-base-content text-center">
              {tCreate('insufficientMeritsPopup', { cost: pollCost })}
            </p>
            <div className="flex justify-center mt-4">
              <Button
                onClick={() => router.push(`/meriter/communities/${communityId}?tappalka=1`)}
                className="mt-2"
              >
                {tCommunities('tappalka') || 'Earn merits'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout
      communityId={communityId}
      stickyHeader={
        <SimpleStickyHeader
          title={t('createTitle')}
          showBack={true}
          onBack={() => router.push(`/meriter/communities/${communityId}`)}
          asStickyHeader={true}
        />
      }
    >
      <div className="space-y-6">
        <FormPollCreate
          communityId={communityId}
          onSuccess={(pollId) => {
            router.push(`/meriter/communities/${communityId}?poll=${pollId}`);
          }}
          onCancel={() => {
            router.push(`/meriter/communities/${communityId}`);
          }}
        />
      </div>
    </AdaptiveLayout>
  );
}

