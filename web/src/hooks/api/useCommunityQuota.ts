// Community quota React Query hooks
import { useQueries } from '@tanstack/react-query';
import { usersApiV1 } from '@/lib/api/v1';
import { useAuth } from '@/contexts/AuthContext';

export interface CommunityQuota {
  communityId: string;
  dailyQuota: number;
  usedToday: number;
  remainingToday: number;
  resetAt: string;
}

/**
 * Fetch quota for multiple communities in parallel
 * @param communityIds Array of community IDs to fetch quota for
 * @returns Array of query results, one per community
 */
export function useCommunityQuotas(communityIds: string[]) {
  const { user } = useAuth();

  const queries = useQueries({
    queries: communityIds.map((communityId) => ({
      queryKey: ['user-quota', user?.id, communityId],
      queryFn: () => usersApiV1.getUserQuota(user?.id || '', communityId),
      enabled: !!user?.id && !!communityId,
      staleTime: 1 * 60 * 1000, // 1 minute
    })),
  });

  // Map results to include communityId for easier access
  const quotasMap = new Map<string, CommunityQuota>();
  queries.forEach((query, index) => {
    if (query.data && communityIds[index]) {
      quotasMap.set(communityIds[index], {
        communityId: communityIds[index],
        ...query.data,
      });
    }
  });

  return {
    queries,
    quotasMap,
  };
}

