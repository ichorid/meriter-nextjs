'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { ProfileTopBar } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc/client';
import { MeritTransferFeed } from '@/features/merit-transfer/components/MeritTransferFeed';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/shadcn/tabs';
import { Button } from '@/components/ui/shadcn/button';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useWallets } from '@/hooks/api/useWallet';
import type { Wallet } from '@/types/api-v1';

const PAGE_LIMIT = 20;

type DirectionTab = 'incoming' | 'outgoing';

export default function ProfileMeritTransfersClient() {
  const t = useTranslations('meritTransfer');
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [tab, setTab] = useState<DirectionTab>('incoming');

  const userId = user?.id ?? '';

  const incomingQuery = trpc.meritTransfer.getByUser.useInfiniteQuery(
    {
      userId,
      direction: 'incoming',
      page: 1,
      limit: PAGE_LIMIT,
    },
    {
      initialPageParam: 1,
      getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
      enabled: !!userId && tab === 'incoming',
    },
  );

  const outgoingQuery = trpc.meritTransfer.getByUser.useInfiniteQuery(
    {
      userId,
      direction: 'outgoing',
      page: 1,
      limit: PAGE_LIMIT,
    },
    {
      initialPageParam: 1,
      getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
      enabled: !!userId && tab === 'outgoing',
    },
  );

  const activeQuery = tab === 'incoming' ? incomingQuery : outgoingQuery;

  const incomingItems = useMemo(
    () => incomingQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [incomingQuery.data?.pages],
  );

  const outgoingItems = useMemo(
    () => outgoingQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [outgoingQuery.data?.pages],
  );

  const loadMoreRef = useInfiniteScroll({
    hasNextPage: activeQuery.hasNextPage ?? false,
    fetchNextPage: () => {
      void activeQuery.fetchNextPage();
    },
    isFetchingNextPage: activeQuery.isFetchingNextPage,
    threshold: 200,
  });

  const { data: walletsRaw = [] } = useWallets();
  const wallets = walletsRaw as Wallet[];

  const pageHeader = (
    <ProfileTopBar asStickyHeader title={t('profilePageTitle')} showBack />
  );

  if (authLoading || !isAuthenticated) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader} wallets={wallets}>
        <div className="flex h-64 flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!user?.id) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader} wallets={wallets}>
        <p className="p-4 text-sm text-base-content/70">{t('pageLoginRequired')}</p>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout className="feed" stickyHeader={pageHeader} wallets={wallets}>
      <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as DirectionTab)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="incoming">{t('tabIncoming')}</TabsTrigger>
            <TabsTrigger value="outgoing">{t('tabOutgoing')}</TabsTrigger>
          </TabsList>
          <TabsContent value="incoming" className="mt-4 outline-none">
            <MeritTransferFeed
              mode="incoming"
              items={incomingItems}
              isLoading={incomingQuery.isLoading && tab === 'incoming'}
            />
            {incomingQuery.error ? (
              <p className="mt-2 text-sm text-destructive">{incomingQuery.error.message}</p>
            ) : null}
          </TabsContent>
          <TabsContent value="outgoing" className="mt-4 outline-none">
            <MeritTransferFeed
              mode="outgoing"
              items={outgoingItems}
              isLoading={outgoingQuery.isLoading && tab === 'outgoing'}
            />
            {outgoingQuery.error ? (
              <p className="mt-2 text-sm text-destructive">{outgoingQuery.error.message}</p>
            ) : null}
          </TabsContent>
        </Tabs>

        {activeQuery.hasNextPage ? (
          <div ref={loadMoreRef} className="flex justify-center py-4">
            {activeQuery.isFetchingNextPage ? (
              <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => void activeQuery.fetchNextPage()}>
                {t('loadMore')}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </AdaptiveLayout>
  );
}
