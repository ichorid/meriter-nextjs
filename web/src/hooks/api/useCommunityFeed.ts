// Community Feed React Query hook
import { trpc } from '@/lib/trpc/client';

interface FeedQueryParams {
  pageSize?: number;
  sort?: 'recent' | 'score';
  tag?: string;
  search?: string;
  impactArea?: string;
  stage?: string;
  beneficiaries?: string[];
  methods?: string[];
  helpNeeded?: string[];
  categories?: string[]; // Array of category IDs
  valueTags?: string[];
}

export function useCommunityFeed(
  communityId: string,
  params: FeedQueryParams = {},
  options?: { enabled?: boolean },
) {
  const { pageSize = 5, sort = 'score', tag, search, impactArea, stage, beneficiaries, methods, helpNeeded, categories, valueTags } = params;
  const enabled = options?.enabled !== false;

  return trpc.communities.getFeed.useInfiniteQuery(
    {
      communityId,
      page: 1, // Initial page - tRPC uses cursor parameter for pagination
      pageSize,
      sort,
      tag,
      search,
      impactArea,
      stage,
      beneficiaries,
      methods,
      helpNeeded,
      categories,
      valueTags,
    },
    {
      getNextPageParam: (lastPage) => {
        if (lastPage?.pagination?.hasNext) {
          return lastPage.pagination.page + 1;
        }
        return undefined;
      },
      initialPageParam: 1,
      enabled: enabled && !!communityId,
    },
  );
}

