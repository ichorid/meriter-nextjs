'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { ProfileTopBar } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useMyInvestments, type MyInvestmentsSort, type MyInvestmentsFilter } from '@/hooks/api/useMyInvestments';
import { useInvestmentDetails } from '@/hooks/api/useInvestmentDetails';
import { InvestmentStatsHeader } from '@/components/organisms/Profile/InvestmentStatsHeader';
import { InvestmentCard } from '@/components/organisms/Profile/InvestmentCard';
import { InvestmentDetailView } from '@/components/organisms/Profile/InvestmentDetailView';
import { EmptyState } from '@/components/organisms/EmptyState/EmptyState';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { useWallets } from '@/hooks/api';
import type { Wallet } from '@/types/api-v1';

const SORT_OPTIONS: { value: MyInvestmentsSort; labelKey: string }[] = [
  { value: 'date', labelKey: 'sortRecent' },
  { value: 'amount', labelKey: 'sortAmount' },
  { value: 'earnings', labelKey: 'sortReturns' },
];

const FILTER_OPTIONS: { value: MyInvestmentsFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'filterAll' },
  { value: 'active', labelKey: 'filterActive' },
  { value: 'closed', labelKey: 'filterClosed' },
];

export default function ProfileInvestmentsPage() {
  const t = useTranslations('profile.investments');
  const { user, isLoading: userLoading, isAuthenticated } = useAuth();
  const [sort, setSort] = useState<MyInvestmentsSort>('date');
  const [filter, setFilter] = useState<MyInvestmentsFilter>('all');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const {
    stats,
    items,
    totalCount,
    isLoading,
    isFetching,
    hasNextPage,
    fetchNextPage,
    resetPage,
  } = useMyInvestments(sort, filter);

  const { data: detailsData, isLoading: detailsLoading } =
    useInvestmentDetails(selectedPostId);

  const observerTarget = useInfiniteScroll({
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage: isFetching,
    threshold: 200,
  });

  useEffect(() => {
    resetPage();
  }, [sort, filter, resetPage]);

  const { data: walletsRaw = [] } = useWallets();
  const wallets = walletsRaw as Wallet[];

  const pageHeader = (
    <ProfileTopBar
      asStickyHeader={true}
      title={t('title')}
      showBack={true}
    />
  );

  if (userLoading || !isAuthenticated) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader}>
        <div className="flex flex-1 items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  const showEmpty =
    !isLoading && !isFetching && items.length === 0 && (!stats || totalCount === 0);

  return (
    <AdaptiveLayout
      className="feed"
      stickyHeader={pageHeader}
      wallets={wallets}
      myId={user?.id}
    >
      <div className="space-y-4">
        {stats && (
          <InvestmentStatsHeader
            totalInvested={stats.totalInvested}
            totalEarned={stats.totalEarned}
            sroi={stats.sroi}
            activeCount={stats.activeCount}
            closedCount={stats.closedCount}
            isLoading={isLoading && items.length === 0}
          />
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex rounded-lg border border-base-300 bg-base-100 p-1">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  filter === opt.value
                    ? 'bg-base-300 text-base-content font-medium'
                    : 'text-base-content/70 hover:text-base-content'
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="investments-sort" className="text-sm text-base-content/60">
              {t('sortBy')}
            </label>
            <select
              id="investments-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as MyInvestmentsSort)}
              className="rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm text-base-content"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {showEmpty ? (
          <EmptyState
            title={t('emptyTitle')}
            message={t('emptyMessage')}
          />
        ) : (
          <>
            {isLoading && items.length === 0 ? (
              <div className="space-y-3">
                <div className="h-24 rounded-xl bg-base-200/50 animate-pulse" />
                <div className="h-24 rounded-xl bg-base-200/50 animate-pulse" />
                <div className="h-24 rounded-xl bg-base-200/50 animate-pulse" />
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <InvestmentCard
                    key={item.postId}
                    item={item}
                    onClick={() => setSelectedPostId(item.postId)}
                  />
                ))}
                <div ref={observerTarget} className="h-4" />
                {isFetching && items.length > 0 && (
                  <div className="flex justify-center py-2">
                    <Loader2 className="w-5 h-5 animate-spin text-base-content/50" />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog
        open={!!selectedPostId}
        onOpenChange={(open) => !open && setSelectedPostId(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('detailsTitle')}</DialogTitle>
          </DialogHeader>
          <InvestmentDetailView
            data={detailsData}
            isLoading={detailsLoading}
            onClose={() => setSelectedPostId(null)}
          />
        </DialogContent>
      </Dialog>
    </AdaptiveLayout>
  );
}
