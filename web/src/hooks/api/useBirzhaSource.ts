'use client';

import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc/client';
import { useToastStore } from '@/shared/stores/toast.store';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';
import { STALE_TIME } from '@/lib/constants/query-config';

export function usePublishToBirzhaSource(params: {
  sourceEntityType: 'project' | 'community';
  sourceEntityId: string;
}) {
  const utils = trpc.useUtils();
  const addToast = useToastStore((s) => s.addToast);
  const t = useTranslations('birzhaSource');

  const projectMut = trpc.project.publishToBirzha.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate();
      utils.project.getWallet.invalidate();
      utils.communities.getCommunityWallet.invalidate();
      utils.publications.getFeed.invalidate();
      utils.publications.getBirzhaPostsBySource.invalidate();
      addToast(t('publishedSuccess'), 'success');
    },
    onError: (err) => {
      addToast(resolveApiErrorToastMessage(err.message), 'error');
    },
  });

  const communityMut = trpc.communities.publishToBirzha.useMutation({
    onSuccess: () => {
      utils.communities.getById.invalidate();
      utils.communities.getCommunityWallet.invalidate();
      utils.publications.getFeed.invalidate();
      utils.publications.getBirzhaPostsBySource.invalidate();
      addToast(t('publishedSuccess'), 'success');
    },
    onError: (err) => {
      addToast(resolveApiErrorToastMessage(err.message), 'error');
    },
  });

  const isPending = projectMut.isPending || communityMut.isPending;

  return {
    isPending,
    mutate: (input: {
      title: string;
      content: string;
      type: 'text' | 'image' | 'video';
      images?: string[];
      investorSharePercent?: number;
    }) => {
      if (params.sourceEntityType === 'project') {
        projectMut.mutate({
          projectId: params.sourceEntityId,
          title: input.title,
          content: input.content,
          type: input.type,
          images: input.images,
          investorSharePercent: input.investorSharePercent ?? 20,
        });
      } else {
        communityMut.mutate({
          communityId: params.sourceEntityId,
          title: input.title,
          content: input.content,
          type: input.type,
          images: input.images,
        });
      }
    },
  };
}

export function useBirzhaPostsBySource(
  sourceEntityType: 'project' | 'community',
  sourceEntityId: string | null | undefined,
  opts?: { enabled?: boolean },
) {
  return trpc.publications.getBirzhaPostsBySource.useQuery(
    {
      sourceEntityType,
      sourceEntityId: sourceEntityId ?? '',
      limit: 20,
      skip: 0,
    },
    {
      enabled: Boolean(sourceEntityId && opts?.enabled !== false),
      staleTime: STALE_TIME.SHORT,
    },
  );
}

export function useCommunityWalletForSource(communityId: string | null | undefined, enabled: boolean) {
  return trpc.communities.getCommunityWallet.useQuery(
    { communityId: communityId ?? '' },
    { enabled: Boolean(communityId) && enabled, staleTime: STALE_TIME.VERY_SHORT },
  );
}

export function useTopUpPublicationRating() {
  const utils = trpc.useUtils();

  return trpc.publications.topUpRating.useMutation({
    onSuccess: () => {
      utils.publications.getById.invalidate();
      utils.publications.getFeed.invalidate();
      utils.communities.getCommunityWallet.invalidate();
      utils.project.getWallet.invalidate();
    },
  });
}
