'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useProfileTabState, type ProfileTab, type SortOrder } from '@/hooks/useProfileTabState';

export function useProfileTabSortFromSearch(tab: ProfileTab): SortOrder {
  const searchParams = useSearchParams();
  const { sortByTab, setSortByTab } = useProfileTabState();

  useEffect(() => {
    const sortParam = searchParams?.get('sort');
    if (sortParam === 'voted' || sortParam === 'recent') {
      setSortByTab((prev) => ({
        ...prev,
        [tab]: sortParam,
      }));
    }
  }, [searchParams, setSortByTab, tab]);

  return sortByTab[tab];
}
