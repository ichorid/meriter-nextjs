import { useMemo } from 'react';
import { useCommunities } from '@/hooks/api/useCommunities';

type CommunityListItem = { id: string; typeTag?: string };

/**
 * ID of the marathon-of-good (Birzha / МД) community — used for global tappalka mining entry.
 */
export function useBirzhaCommunityId(): string | null {
  const { data: communitiesData } = useCommunities();
  return useMemo(() => {
    const list = communitiesData?.data as CommunityListItem[] | undefined;
    return list?.find((c) => c.typeTag === 'marathon-of-good')?.id ?? null;
  }, [communitiesData?.data]);
}
