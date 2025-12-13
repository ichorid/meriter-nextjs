import { useMemo } from 'react';
import { useUserCommunities } from '@/hooks/useUserCommunities';

/**
 * Hook to get daily quota from "marathon-of-good" communities
 * 
 * @returns Object containing:
 *   - remaining: sum of remainingToday from all marathon-of-good communities
 *   - max: sum of dailyQuota from all marathon-of-good communities
 *   - isLoading: loading state
 */
export function useMarathonOfGoodQuota() {
  const { communities, quotasMap, isLoading } = useUserCommunities();

  // Filter communities by typeTag === 'marathon-of-good'
  const marathonCommunities = useMemo(() => {
    return communities.filter((c: any) => c?.typeTag === 'marathon-of-good');
  }, [communities]);

  // Calculate remaining and max quota
  const { remaining, max } = useMemo(() => {
    let remainingTotal = 0;
    let maxTotal = 0;

    marathonCommunities.forEach((community: any) => {
      const quota = quotasMap.get(community.id);
      if (quota) {
        remainingTotal += quota.remainingToday || 0;
        maxTotal += quota.dailyQuota || 0;
      }
    });

    return {
      remaining: remainingTotal,
      max: maxTotal,
    };
  }, [marathonCommunities, quotasMap]);

  return {
    remaining,
    max,
    isLoading,
  };
}



