'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { ProfileTopBar } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc/client';
import {
  MeritHistoryFeed,
  type MeritHistoryFeedRow,
} from '@/features/merit-transfer/components/MeritHistoryFeed';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/shadcn/tabs';
import { Button } from '@/components/ui/shadcn/button';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useWallets } from '@/hooks/api/useWallet';
import type { Wallet } from '@/types/api-v1';

const PAGE_LIMIT = 20;

/** Mirrors `MERIT_HISTORY_FILTER_KEYS` on the API — keep aligned when extending filters. */
type MeritHistoryFilterTab =
  | 'all'
  | 'peer_transfer'
  | 'voting'
  | 'investment'
  | 'tappalka'
  | 'fees_and_forward'
  | 'withdrawals'
  | 'welcome_and_system'
  | 'other';

const FILTER_TABS: MeritHistoryFilterTab[] = [
  'all',
  'peer_transfer',
  'voting',
  'investment',
  'tappalka',
  'fees_and_forward',
  'withdrawals',
  'welcome_and_system',
  'other',
];

export default function ProfileMeritTransfersClient() {
  const tMt = useTranslations('meritTransfer');
  const tHist = useTranslations('meritHistory');
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [tab, setTab] = useState<MeritHistoryFilterTab>('all');

  const userId = user?.id ?? '';

  const txQuery = trpc.wallets.getTransactions.useInfiniteQuery(
    {
      userId,
      limit: PAGE_LIMIT,
      category: tab === 'all' ? undefined : tab,
    },
    {
      initialPageParam: 0,
      getNextPageParam: (lastPage) =>
        lastPage.hasMore ? lastPage.skip + lastPage.data.length : undefined,
      enabled: !!userId,
    },
  );

  const rows = useMemo(() => {
    const pages = txQuery.data?.pages ?? [];
    const flat = pages.flatMap((p) => p.data);
    return flat.map(
      (row): MeritHistoryFeedRow => ({
        id: row.id,
        type: row.type,
        amount: row.amount,
        description: row.description,
        referenceType: row.referenceType,
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : String(row.createdAt),
        meritHistoryCategory: row.meritHistoryCategory,
        ledgerMultiplier: row.ledgerMultiplier,
        meritHistoryEnrichment: row.meritHistoryEnrichment ?? null,
      }),
    );
  }, [txQuery.data?.pages]);

  const tabLabelKey = (key: MeritHistoryFilterTab): string => `filter.${key}`;

  const loadMoreRef = useInfiniteScroll({
    hasNextPage: txQuery.hasNextPage ?? false,
    fetchNextPage: () => {
      void txQuery.fetchNextPage();
    },
    isFetchingNextPage: txQuery.isFetchingNextPage,
    threshold: 200,
  });

  const { data: walletsRaw = [] } = useWallets();
  const wallets = walletsRaw as Wallet[];

  const pageHeader = (
    <ProfileTopBar asStickyHeader title={tHist('pageTitle')} showBack />
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
        <p className="p-4 text-sm text-base-content/70">{tMt('pageLoginRequired')}</p>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout className="feed" stickyHeader={pageHeader} wallets={wallets}>
      <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as MeritHistoryFilterTab)} className="w-full">
          <TabsList
            className="flex h-auto w-full flex-wrap gap-1 overflow-x-auto lg:grid lg:grid-cols-5"
            aria-label={tHist('filtersAriaLabel')}
          >
            {FILTER_TABS.map((key) => (
              <TabsTrigger
                key={key}
                id={`merit-history-tab-${key}`}
                value={key}
                className="shrink-0 text-xs lg:text-sm"
              >
                {tHist(tabLabelKey(key))}
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
    </AdaptiveLayout>
  );
}
