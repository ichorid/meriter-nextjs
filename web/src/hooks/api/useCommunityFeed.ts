// Community Feed React Query hook
import { useInfiniteQuery } from '@tanstack/react-query';
import { communitiesApi } from '@/lib/api/wrappers/communities-api';
import { queryKeys } from '@/lib/constants/queryKeys';
import type { PaginatedResponse } from '@/types/api-v1';

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
      return communitiesApi.getPublications(communityId, {
        page: pageParam,
        pageSize,
        sort,
        tag,
      });
    },
    getNextPageParam: (lastPage: PaginatedResponse<FeedItem>) => {
      if (!lastPage.meta?.pagination?.hasNext) {
        return undefined;
      }
      return (lastPage.meta?.pagination?.page || 1) + 1;
    },
    initialPageParam: 1,
    enabled: !!communityId,
  });
}

