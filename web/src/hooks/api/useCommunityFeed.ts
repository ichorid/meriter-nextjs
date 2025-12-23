// Community Feed React Query hook
import { trpc } from '@/lib/trpc/client';

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
  
  return trpc.communities.getFeed.useInfiniteQuery(
    {
      communityId,
      pageSize,
      sort,
      tag,
    },
    {
      getNextPageParam: (lastPage) => {
        if (lastPage.pagination.hasNext) {
          return lastPage.pagination.page + 1;
        }
        return undefined;
      },
      initialPageParam: 1,
      enabled: !!communityId,
    },
  );
}

