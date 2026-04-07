import { useMemo } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useAuth } from '@/contexts/AuthContext';
import { STALE_TIME } from '@/lib/constants/query-config';

export interface CommunityQuota {
  communityId: string;
  dailyQuota: number;
  usedToday: number;
  remainingToday: number;
  resetAt: string;
}

/**
 * Fetch quota for multiple communities in a single batch request.
 * Returns a Map of communityId -> CommunityQuota.
 */
export function useCommunityQuotas(communityIds: string[]) {
  const { user } = useAuth();

  // Stabilize input: dedupe + sort so the tRPC query key stays consistent
  const idsJoined = [...new Set(communityIds.filter(Boolean))].sort().join(',');
  const stableIds = useMemo(
    () => (idsJoined ? idsJoined.split(',') : []),
    [idsJoined],
  );

  const { data } = trpc.wallets.getQuotaBatch.useQuery(
    { communityIds: stableIds },
    {
      enabled: !!user?.id && stableIds.length > 0,
      staleTime: STALE_TIME.SHORT,
      retry: false,
    },
  );

  const quotasMap = useMemo(() => {
    const map = new Map<string, CommunityQuota>();
    if (!data) return map;
    for (const [communityId, quota] of Object.entries(data)) {
      if (typeof quota.remaining !== 'number') continue;
      map.set(communityId, {
        communityId,
        dailyQuota: quota.dailyQuota ?? 0,
        usedToday: quota.used ?? 0,
        remainingToday: quota.remaining,
        resetAt: quota.resetAt ?? '',
      });
    }
    return map;
  }, [data]);

  return { quotasMap };
}
