'use client';

import { useMemo } from 'react';
import { trpc } from '@/lib/trpc/client';
import { STALE_TIME } from '@/lib/constants/query-config';
import type { CommunityHubFeedTab } from '@/features/communities/components/CommunityHubFeedTabBar';

export type CommunityHubFeedTabCounts = Partial<Record<CommunityHubFeedTab, number>>;

export function useCommunityHubFeedTabCounts(
  communityId: string,
  visibleTabs: readonly CommunityHubFeedTab[],
  options?: { hubKind?: 'community' | 'project'; enabled?: boolean },
) {
  const hubKind = options?.hubKind ?? 'community';
  const enabled = options?.enabled !== false && Boolean(communityId) && visibleTabs.length > 0;

  const { data, isLoading, isFetching } = trpc.communities.getHubFeedTabCounts.useQuery(
    {
      communityId,
      tabs: [...visibleTabs],
      hubKind,
    },
    {
      enabled,
      staleTime: STALE_TIME.SHORT,
    },
  );

  const counts = useMemo((): CommunityHubFeedTabCounts => data ?? {}, [data]);

  return {
    counts,
    isLoading: enabled && (isLoading || isFetching),
  };
}

export function formatHubFeedTabCount(value: number): string {
  if (value > 99) {
    return '99+';
  }
  return String(value);
}
