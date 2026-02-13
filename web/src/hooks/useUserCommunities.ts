import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserMeritsBalance } from '@/hooks/useUserMeritsBalance';
import { useCommunitiesBatch, useCommunities } from '@/hooks/api/useCommunities';
import { trpc } from '@/lib/trpc/client';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import type { Community } from '@/types/api-v1';

/**
 * Hook to get user's communities with wallets and quotas
 *
 * For regular users: Gets communities from membership (users.getUserCommunities), not from wallets.
 * __global__ is wallet-only and must never be shown as a community.
 * For superadmin: Gets all communities
 *
 * @returns Object containing:
 *   - communities: array of Community objects
 *   - communityIds: array of community IDs
 *   - wallets: array of user's wallets
 *   - quotasMap: map of community IDs to their quota data
 *   - walletsMap: map of community IDs to wallets for quick lookup
 *   - isLoading: loading state
 */
export function useUserCommunities() {
  const { user } = useAuth();
  const isSuperadmin = user?.globalRole === 'superadmin';

  // Wallets and quotas (used for balance display; may include global wallet)
  const { quotasMap, wallets, walletsLoading } = useUserMeritsBalance();

  // Membership-based community IDs for regular users (backend excludes __global__)
  const { data: membershipData, isLoading: membershipLoading } = trpc.users.getUserCommunities.useQuery(
    { userId: 'me' },
    { enabled: !!user && !isSuperadmin }
  );
  const membershipCommunityIds = useMemo(() => {
    const ids = membershipData?.map((c) => c.id) ?? [];
    return ids.filter((id) => id !== GLOBAL_COMMUNITY_ID);
  }, [membershipData]);

  // For superadmin: fetch all communities
  const { data: allCommunitiesData, isLoading: allCommunitiesLoading } = useCommunities();

  // For regular users: batch fetch communities from membership IDs (not wallet IDs)
  const { communities: memberCommunities, isLoading: memberCommunitiesLoading } = useCommunitiesBatch(membershipCommunityIds);

  // Determine which communities to use
  const communities = useMemo(() => {
    if (isSuperadmin) {
      return allCommunitiesData?.data || [];
    }
    return memberCommunities;
  }, [isSuperadmin, allCommunitiesData, memberCommunities]);

  // Get community IDs from the communities array, sorted with special communities first
  const communityIds = useMemo(() => {
    // Sort communities: special communities first (marathon-of-good, future-vision, support), then others
    const sorted = [...communities].sort((a: Community, b: Community) => {
      const getSpecialOrder = (typeTag?: string): number => {
        if (typeTag === 'marathon-of-good') return 1;
        if (typeTag === 'future-vision') return 2;
        if (typeTag === 'team-projects') return 3;
        if (typeTag === 'support') return 4;
        return 999; // Regular communities go last
      };
      return getSpecialOrder(a.typeTag) - getSpecialOrder(b.typeTag);
    });
    return sorted.map((c: Community) => c.id);
  }, [communities]);

  // Create a map of communityId -> wallet for quick lookup
  const walletsMap = useMemo(() => {
    const map = new Map<string, typeof wallets[0]>();
    wallets.forEach((wallet: any) => {
      if (wallet?.communityId) {
        map.set(wallet.communityId, wallet);
      }
    });
    return map;
  }, [wallets]);

  // Combined loading state
  const isLoading =
    walletsLoading ||
    (isSuperadmin ? allCommunitiesLoading : membershipLoading || memberCommunitiesLoading);

  return {
    communities,
    communityIds,
    wallets,
    quotasMap,
    walletsMap,
    isLoading,
  };
}

