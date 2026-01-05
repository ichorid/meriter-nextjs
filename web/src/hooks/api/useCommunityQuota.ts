// Community quota React Query hooks - migrated to tRPC
import { trpc } from '@/lib/trpc/client';
import { useAuth } from '@/contexts/AuthContext';
import { quotaKeys } from './useQuota';
import { STALE_TIME } from '@/lib/constants/query-config';
import { useBatchQueries } from './useBatchQueries';

export interface CommunityQuota {
  communityId: string;
  dailyQuota: number;
  usedToday: number;
  remainingToday: number;
  resetAt: string;
}

interface QuotaData {
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
  const utils = trpc.useUtils();

  const result = useBatchQueries<QuotaData, string>({
    ids: communityIds,
    queryKey: (communityId) => quotaKeys.quota(user?.id, communityId),
    queryFn: async (communityId) => {
      const data = await utils.wallets.getQuota.fetch({ userId: 'me', communityId });
      return {
        dailyQuota: data.dailyQuota,
        usedToday: data.used,
        remainingToday: data.remaining,
        resetAt: new Date().toISOString(), // TODO: Get actual reset time from backend
      };
    },
    enabled: (communityId) => !!user?.id && !!communityId,
    staleTime: STALE_TIME.SHORT,
    retry: false, // Don't retry on quota errors (community not configured)
    shouldInclude: (data, _id, query) => {
      // Only include if data exists, no error, and has valid structure
      return !!data && !query.error && typeof data.remainingToday === 'number';
    },
    transformData: (data, communityId) => {
      // Transform to include communityId
      return {
        communityId,
        dailyQuota: data.dailyQuota ?? 0,
        usedToday: data.usedToday ?? 0,
        remainingToday: data.remainingToday, // Keep original value, even if 0
        resetAt: data.resetAt ?? '',
      } as CommunityQuota;
    },
  });

  return {
    queries: result.queries,
    quotasMap: result.dataMap as Map<string, CommunityQuota>,
  };
}

