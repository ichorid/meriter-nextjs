'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { trpc } from '@/lib/trpc/client';
import { MeritTransferFeed } from '@/features/merit-transfer/components/MeritTransferFeed';
import { Button } from '@/components/ui/shadcn/button';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_LIMIT = 20;

export interface MeritTransfersByContextPageProps {
  communityContextId: string;
  backHref: string;
  /** i18n key under meritTransfer: pageTitleCommunity | pageTitleProject */
  titleKey: 'pageTitleCommunity' | 'pageTitleProject';
}

export function MeritTransfersByContextPage({
  communityContextId,
  backHref,
  titleKey,
}: MeritTransfersByContextPageProps) {
  const router = useRouter();
  const t = useTranslations('meritTransfer');
  const { user, isLoading: authLoading } = useAuth();

  const query = trpc.meritTransfer.getByCommunity.useInfiniteQuery(
    { communityId: communityContextId, page: 1, limit: PAGE_LIMIT },
    {
      initialPageParam: 1,
      getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
      enabled: !!communityContextId && !!user?.id,
    },
  );

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.data) ?? [],
    [query.data?.pages],
  );

  const loadMoreRef = useInfiniteScroll({
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
    isFetchingNextPage: query.isFetchingNextPage,
    threshold: 200,
  });

  const pageHeader = (
    <SimpleStickyHeader
      title={t(titleKey)}
      showBack
      onBack={() => router.push(backHref)}
      asStickyHeader
      showScrollToTop
    />
  );

  if (authLoading) {
    return (
      <AdaptiveLayout
        className="feed"
        communityId={communityContextId}
        myId={user?.id}
        stickyHeader={pageHeader}
      >
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!user?.id) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader}>
        <p className="p-4 text-sm text-base-content/70">{t('pageLoginRequired')}</p>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout
      className="feed"
      communityId={communityContextId}
      myId={user.id}
      stickyHeader={pageHeader}
    >
      <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
        <MeritTransferFeed
          mode="community"
          items={items}
          isLoading={query.isLoading}
        />
        {query.error ? (
          <p className="text-sm text-destructive">{query.error.message}</p>
        ) : null}
        {query.hasNextPage ? (
          <div ref={loadMoreRef} className="flex justify-center py-4">
            {query.isFetchingNextPage ? (
              <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => void query.fetchNextPage()}>
                {t('loadMore')}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </AdaptiveLayout>
  );
}
