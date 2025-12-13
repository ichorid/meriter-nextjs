// Community Feed React Query hook
import { useInfiniteQuery } from '@tanstack/react-query';
import { communitiesApiV1 } from '@/lib/api/v1';
import { queryKeys } from '@/lib/constants/queryKeys';
import type { PaginatedResponse } from '@/types/api-v1';
import { createGetNextPageParam } from '@/lib/utils/pagination-utils';

interface FeedItem {
  id: string;
  type: 'publication' | 'poll';
  communityId: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  slug?: string;
  [key: string]: unknown;
}

interface FeedQueryParams {
  pageSize?: number;
  sort?: 'recent' | 'score';
  tag?: string;
}

export function useCommunityFeed(
  communityId: string,
  params: FeedQueryParams = {}
) {
  const { pageSize = 5, sort = 'score', tag } = params;
  
  return useInfiniteQuery({
    queryKey: queryKeys.communities.feed(communityId, params),
    queryFn: ({ pageParam }: { pageParam: number }) => {
      return communitiesApiV1.getCommunityFeed(communityId, {
        page: pageParam,
        pageSize,
        sort,
        tag,
      });
    },
    getNextPageParam: createGetNextPageParam<FeedItem>(),
    initialPageParam: 1,
    enabled: !!communityId,
  });
}

