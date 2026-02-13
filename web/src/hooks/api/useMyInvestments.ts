import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';

export type MyInvestmentsSort = 'date' | 'amount' | 'earnings';
export type MyInvestmentsFilter = 'all' | 'active' | 'closed';

const PAGE_SIZE = 20;

export function useMyInvestments(
  sort: MyInvestmentsSort,
  filter: MyInvestmentsFilter,
) {
  const [page, setPage] = useState(1);
  const [accumulatedItems, setAccumulatedItems] = useState<
    Array<{
      postId: string;
      postTitle: string;
      postAuthor: { name: string; avatarUrl?: string };
      communityId: string;
      communityName: string;
      investedAmount: number;
      sharePercent: number;
      totalEarnings: number;
      postStatus: 'active' | 'closed';
      postRating: number;
      investmentPool: number;
      ttlExpiresAt: Date | null;
      lastWithdrawalDate: Date | null;
    }>
  >([]);

  const { data, isLoading, isFetching } = trpc.users.myInvestments.useQuery(
    {
      sort,
      filter,
      page,
      limit: PAGE_SIZE,
    },
  );

  const hasNextPage =
    data != null && accumulatedItems.length + (page === 1 ? 0 : data.items.length) < data.totalCount;
  const totalCount = data?.totalCount ?? 0;
  const stats = data?.stats;

  useEffect(() => {
    if (!data) return;
    if (page === 1) {
      setAccumulatedItems(data.items);
    } else {
      setAccumulatedItems((prev) => [...prev, ...data.items]);
    }
  }, [data, page]);

  const resetPage = useCallback(() => {
    setPage(1);
    setAccumulatedItems([]);
  }, []);

  const fetchNextPage = useCallback(() => {
    if (data && accumulatedItems.length < data.totalCount) {
      setPage((p) => p + 1);
    }
  }, [data, accumulatedItems.length]);

  return {
    stats,
    items: accumulatedItems,
    totalCount,
    isLoading,
    isFetching,
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
    resetPage,
    setPage,
  };
}

/**
 * Lightweight count for profile card. Fetches first page with limit 1 to get totalCount.
 */
export function useMyInvestmentsCount() {
  const { data, isLoading } = trpc.users.myInvestments.useQuery(
    { page: 1, limit: 1, sort: 'date', filter: 'all' },
    { staleTime: 60 * 1000 },
  );
  return { count: data?.totalCount ?? 0, isLoading };
}
