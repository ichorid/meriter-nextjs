'use client';

import { trpc } from '@/lib/trpc/client';
import { STALE_TIME } from '@/lib/constants/query-config';

export interface FutureVisionsFilters {
  page?: number;
  pageSize?: number;
  tags?: string[];
  sort?: 'score' | 'createdAt';
}

export function useFutureVisions(filters: FutureVisionsFilters = {}) {
  return trpc.communities.getFutureVisions.useQuery(
    {
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 20,
      tags: filters.tags,
      sort: filters.sort,
    },
    { staleTime: STALE_TIME.SHORT },
  );
}

export function useFutureVisionTags() {
  return trpc.platformSettings.get.useQuery(undefined, {
    staleTime: STALE_TIME.LONG,
  });
}
