import { trpc } from '@/lib/trpc/client';
import type { GetTappalkaPairInput } from '../types';

/**
 * Hook to fetch a pair of posts for tappalka comparison
 * 
 * @param communityId - ID of the community to get posts from
 * @param options - Query options (enabled, staleTime, etc.)
 */
export function useTappalkaPair(
  communityId: string,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  },
) {
  return trpc.tappalka.getPair.useQuery(
    { communityId },
    {
      enabled: options?.enabled !== false && !!communityId,
      staleTime: options?.staleTime ?? 0, // Always fresh - don't cache pairs
    },
  );
}

