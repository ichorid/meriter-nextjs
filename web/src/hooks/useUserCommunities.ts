import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserMeritsBalance } from '@/hooks/useUserMeritsBalance';
import { useCommunitiesBatch, useCommunities } from '@/hooks/api/useCommunities';
import type { Community } from '@/types/api-v1';

/**
 * Hook to get user's communities with wallets and quotas
 * 
 * For regular users: Gets communities from wallets (where user has a role)
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

  // Get wallets and community IDs from wallets (for regular users)
  const { communityIds: walletCommunityIds, quotasMap, wallets, walletsLoading } = useUserMeritsBalance();

  // For superadmin: fetch all communities
  const { data: allCommunitiesData, isLoading: allCommunitiesLoading } = useCommunities();

  // For regular users: batch fetch communities from wallet IDs
  const { communities: memberCommunities, isLoading: memberCommunitiesLoading } = useCommunitiesBatch(walletCommunityIds);

  // Determine which communities to use
  const communities = useMemo(() => {
    if (isSuperadmin) {
      return allCommunitiesData?.data || [];
    }
    return memberCommunities;
  }, [isSuperadmin, allCommunitiesData, memberCommunities]);

  // Get community IDs from the communities array
  const communityIds = useMemo(() => {
    return communities.map((c: Community) => c.id);
  }, [communities]);

  // Create a map of communityId -> wallet for quick lookup
  const walletsMap = useMemo(() => {
    const map = new Map<string, typeof wallets[0]>();
    wallets.forEach((wallet: unknown) => {
      if (wallet?.communityId) {
        map.set(wallet.communityId, wallet);
      }
    });
    return map;
  }, [wallets]);

  // Combined loading state
  const isLoading = walletsLoading || (isSuperadmin ? allCommunitiesLoading : memberCommunitiesLoading);

  return {
    communities,
    communityIds,
    wallets,
    quotasMap,
    walletsMap,
    isLoading,
  };
}

