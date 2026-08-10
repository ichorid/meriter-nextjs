'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import {
  MeritHistoryFeed,
} from '@/features/merit-transfer/components/MeritHistoryFeed';
import {
  MeritHistoryDashboardPanel,
  type MeritHistoryDashboardPeriod,
} from '@/features/merit-transfer/components/MeritHistoryDashboardPanel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/shadcn/tabs';
import { Button } from '@/components/ui/shadcn/button';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import {
  MERIT_HISTORY_FILTER_TABS,
  MERIT_HISTORY_PAGE_LIMIT,
  mapWalletTransactionsToFeedRows,
  meritHistoryTabLabelKey,
  type MeritHistoryFilterTab,
} from '../lib/merit-history-shared';

export interface MeritHistoryTabContentProps {
  userId: string;
  queryEnabled: boolean;
  dashboardEnabled: boolean;
  permissionCommunityId?: string;
}

export function MeritHistoryTabContent({
  userId,
  queryEnabled,
  dashboardEnabled,
  permissionCommunityId,
}: MeritHistoryTabContentProps) {
  const tHist = useTranslations('meritHistory');
  const [tab, setTab] = useState<MeritHistoryFilterTab>('all');
  const [dashboardPeriodDays, setDashboardPeriodDays] = useState<MeritHistoryDashboardPeriod>(30);

  const txQuery = trpc.wallets.getTransactions.useInfiniteQuery(
    {
      userId,
      limit: MERIT_HISTORY_PAGE_LIMIT,
      category: tab === 'all' ? undefined : tab,
      permissionCommunityId: permissionCommunityId || undefined,
    },
    {
      initialPageParam: 0,
      getNextPageParam: (lastPage) =>
        lastPage.hasMore ? lastPage.skip + lastPage.data.length : undefined,
      enabled: queryEnabled,
    },
  );

  const rows = useMemo(
    () => mapWalletTransactionsToFeedRows(txQuery.data?.pages),
    [txQuery.data?.pages],
  );

  const loadMoreRef = useInfiniteScroll({
    hasNextPage: txQuery.hasNextPage ?? false,
    fetchNextPage: () => {
      void txQuery.fetchNextPage();
    },
    isFetchingNextPage: txQuery.isFetchingNextPage,
    threshold: 200,
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <MeritHistoryDashboardPanel
        userId={userId}
        category={tab}
        permissionCommunityId={permissionCommunityId}
        enabled={dashboardEnabled}
        periodDays={dashboardPeriodDays}
        onPeriodDaysChange={setDashboardPeriodDays}
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as MeritHistoryFilterTab)} className="w-full">
        <TabsList
          className="flex h-auto w-full flex-wrap gap-1 overflow-x-auto lg:grid lg:grid-cols-5"
          aria-label={tHist('filtersAriaLabel')}
        >
          {MERIT_HISTORY_FILTER_TABS.map((key) => (
            <TabsTrigger
              key={key}
              id={`merit-history-tab-${key}`}
              value={key}
              className="shrink-0 text-xs lg:text-sm"
            >
              {tHist(meritHistoryTabLabelKey(key))}
            </TabsTrigger>
          ))}
        </TabsList>
        <div
          className="mt-4 outline-none"
          role="tabpanel"
          id={`merit-history-panel-${tab}`}
          aria-labelledby={`merit-history-tab-${tab}`}
        >
          <MeritHistoryFeed
            items={rows}
            isLoading={
              txQuery.isLoading || (txQuery.isFetching && !txQuery.data?.pages.length)
            }
          />
          {txQuery.error ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {txQuery.error.message}
            </p>
          ) : null}
        </div>
      </Tabs>
      {txQuery.hasNextPage ? (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {txQuery.isFetchingNextPage ? (
            <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void txQuery.fetchNextPage()}
            >
              {tHist('loadMore')}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
