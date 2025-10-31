// Community quota React Query hooks
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { usersApiV1 } from '@/lib/api/v1';
import { useAuth } from '@/contexts/AuthContext';
import { quotaKeys } from './useQuota';

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

  // Memoize queries array to prevent infinite loops
  // useQueries compares the queries array by reference, so we need stable references
  // Use JSON.stringify to compare array contents instead of reference
  const communityIdsKey = useMemo(() => JSON.stringify([...communityIds].sort()), [communityIds]);
  
  const queriesConfig = useMemo(() => {
    return communityIds.map((communityId) => ({
      queryKey: quotaKeys.quota(user?.id, communityId),
      queryFn: () => usersApiV1.getUserQuota(user?.id || '', communityId),
      enabled: !!user?.id && !!communityId,
      staleTime: 1 * 60 * 1000, // 1 minute
      retry: false, // Don't retry on quota errors (community not configured)
    }));
  }, [communityIdsKey, user?.id]); // Depend on stringified key and user.id

  const queries = useQueries({
    queries: queriesConfig,
  });

  // Map results to include communityId for easier access
  const quotasMap = new Map<string, CommunityQuota>();
  queries.forEach((query, index) => {
    const communityId = communityIds[index];
    console.log(`[useCommunityQuotas] Query ${index} for community ${communityId}:`, {
      hasData: !!query.data,
      data: query.data,
      dataType: typeof query.data,
      remainingToday: query.data?.remainingToday,
      remainingTodayType: typeof query.data?.remainingToday,
      dailyQuota: query.data?.dailyQuota,
      usedToday: query.data?.usedToday,
      error: query.error,
      isLoading: query.isLoading,
      isError: query.isError,
      isSuccess: query.isSuccess,
      status: query.status,
    });
    
    // Only add to map if query has successful data (not error, not loading)
    if (query.data && !query.error && communityId) {
      // Ensure data has the expected structure
      // Note: remainingToday can be 0, which is a valid number!
      if (typeof query.data.remainingToday === 'number') {
        const quotaEntry = {
          communityId: communityId,
          dailyQuota: query.data.dailyQuota ?? 0,
          usedToday: query.data.usedToday ?? 0,
          remainingToday: query.data.remainingToday, // Keep original value, even if 0
          resetAt: query.data.resetAt ?? '',
        };
        console.log(`[useCommunityQuotas] ✅ Adding quota to map for ${communityId}:`, quotaEntry);
        quotasMap.set(communityId, quotaEntry);
      } else {
        console.warn(`[useCommunityQuotas] ❌ Invalid remainingToday for ${communityId}:`, {
          value: query.data.remainingToday,
          type: typeof query.data.remainingToday,
          fullData: query.data,
        });
      }
    } else {
      console.warn(`[useCommunityQuotas] ⚠️ Skipping ${communityId} - no valid data:`, {
        hasData: !!query.data,
        hasError: !!query.error,
        isLoading: query.isLoading,
        error: query.error,
      });
    }
  });
  
  console.log('[useCommunityQuotas] 📋 Final quotasMap:', Array.from(quotasMap.entries()));

  return {
    queries,
    quotasMap,
  };
}

