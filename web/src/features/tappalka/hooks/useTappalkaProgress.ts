import { trpc } from '@/lib/trpc/client';
import type { GetTappalkaProgressInput } from '../types';

/**
 * Hook to fetch user's tappalka progress in a community
 * 
 * @param communityId - ID of the community
 * @param options - Query options (enabled, staleTime, etc.)
 */
export function useTappalkaProgress(
  communityId: string,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  },
) {
  return trpc.tappalka.getProgress.useQuery(
    { communityId },
    {
      enabled: options?.enabled !== false && !!communityId,
      staleTime: options?.staleTime,
    },
  );
}

