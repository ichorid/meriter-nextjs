import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserMeritsBalance } from '@/hooks/useUserMeritsBalance';
import { useCommunitiesBatch } from '@/hooks/api/useCommunities';
import { useUserRoles } from '@/hooks/api/useProfile';
import { trpc } from '@/lib/trpc/client';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import type { Community } from '@/types/api-v1';

/**
 * Hook to get user's communities with wallets and quotas
 *
 * Resolves communities from membership (users.getUserCommunities) + roles via communities.getById batch.
 * __global__ is wallet-only and must never be shown as a community.
 * Do not use communities.getAll for this: the API excludes project communities, so superadmins would miss projects in sidebar/profile.
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

  const { data: userRoles = [] } = useUserRoles(user?.id ?? '');

  // Wallets and quotas (used for balance display; may include global wallet)
  const { quotasMap, wallets, walletsLoading } = useUserMeritsBalance();

  // Membership + community roles (backend excludes __global__ from membership payload)
  const { data: membershipData, isLoading: membershipLoading } = trpc.users.getUserCommunities.useQuery(
    { userId: 'me' },
    { enabled: !!user },
  );
  const membershipCommunityIds = useMemo(() => {
    const fromApi = membershipData?.map((c) => c.id) ?? [];
    const fromRoles = userRoles
      .filter((r) => r.role === 'lead' || r.role === 'participant')
      .map((r) => r.communityId);
    const merged = new Set<string>();
    fromApi.forEach((id) => merged.add(id));
    fromRoles.forEach((id) => merged.add(id));
    merged.delete(GLOBAL_COMMUNITY_ID);
    return Array.from(merged);
  }, [membershipData, userRoles]);

  const { communities: memberCommunities, isLoading: memberCommunitiesLoading } = useCommunitiesBatch(membershipCommunityIds);

  const communities = useMemo(() => {
    if (membershipCommunityIds.length === 0) {
      return [];
    }
    return memberCommunities;
  }, [memberCommunities, membershipCommunityIds]);

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
  const isLoading = walletsLoading || membershipLoading || memberCommunitiesLoading;

  return {
    communities,
    communityIds,
    wallets,
    quotasMap,
    walletsMap,
    isLoading,
  };
}

