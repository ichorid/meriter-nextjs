'use client';

import React, { useEffect } from 'react';
import { PublicationCreateForm } from '@/features/publications/components/PublicationCreateForm';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { PublicationPostType } from '@/features/publications/components/PublicationCreateForm';
import { ENABLE_PROJECT_POSTS } from '@/lib/constants/features';
import { useCommunity } from '@/hooks/api/useCommunities';
import { useWallet } from '@/hooks/api/useWallet';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { Dialog, DialogContent } from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Loader2 } from 'lucide-react';

interface CreatePublicationPageClientProps {
  communityId: string;
}

export function CreatePublicationPageClient({ communityId }: CreatePublicationPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('publications.create');
  const tCommunities = useTranslations('pages.communities');
  const { isAuthenticated, isLoading: userLoading } = useAuth();
  const { data: community } = useCommunity(communityId);
  const { data: feeWallet } = useWallet(GLOBAL_COMMUNITY_ID);

  const postCost = community?.settings?.postCost ?? 1;
  const requiresPayment = postCost > 0;
  const walletBalance = feeWallet?.balance ?? 0;
  const hasInsufficientPayment = requiresPayment && walletBalance < postCost;

  // Get postType from URL params (e.g., ?postType=project)
  const postTypeParam = searchParams?.get('postType');
  let requestedPostType: PublicationPostType = 'basic';
  if (postTypeParam === 'poll' || postTypeParam === 'basic') {
    requestedPostType = postTypeParam as PublicationPostType;
  } else if (postTypeParam === 'project' && ENABLE_PROJECT_POSTS) {
    requestedPostType = 'project';
  }
  const defaultPostType = requestedPostType;

  useEffect(() => {
    if (!userLoading && !isAuthenticated) {
      router.push(`/meriter/login?returnTo=${encodeURIComponent(`/meriter/communities/${communityId}/create`)}`);
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
            title={t('title')}
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
              {t('insufficientMeritsPopup', { cost: postCost })}
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
          title={t('title')}
          showBack={true}
          onBack={() => router.push(`/meriter/communities/${communityId}`)}
          asStickyHeader={true}
        />
      }
    >
      <div className="space-y-6">
        <PublicationCreateForm
          communityId={communityId}
          defaultPostType={defaultPostType}
          onSuccess={(publication) => {
            const postIdentifier = publication.slug || publication.id;
            router.push(`/meriter/communities/${communityId}?highlight=${postIdentifier}`);
          }}
          onCancel={() => {
            router.push(`/meriter/communities/${communityId}`);
          }}
        />
      </div>
    </AdaptiveLayout>
  );
}

