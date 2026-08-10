import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserMeritsBalance } from '@/hooks/useUserMeritsBalance';
import { useCommunitiesBatch } from '@/hooks/api/useCommunities';
import { useUserRoles } from '@/hooks/api/useProfile';
import { trpc } from '@/lib/trpc/client';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import type { Community } from '@/types/api-v1';

type MembershipCommunity = {
  id: string;
  name: string;
  description?: string;
  isProject?: boolean;
  typeTag?: string;
};

function mergeCommunityRecord(
  id: string,
  batch?: Community,
  membership?: MembershipCommunity,
  roleMeta?: { name?: string; typeTag?: string },
): Community {
  if (batch) return batch;
  return {
    id,
    name: membership?.name ?? roleMeta?.name ?? 'Community',
    description: membership?.description ?? '',
    isProject: membership?.isProject ?? false,
    typeTag: membership?.typeTag ?? roleMeta?.typeTag,
  } as Community;
}

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

  const roleMetaByCommunityId = useMemo(() => {
    const map = new Map<string, { name?: string; typeTag?: string }>();
    userRoles.forEach((role) => {
      if (role.communityId) {
        map.set(role.communityId, {
          name: role.communityName,
          typeTag: role.communityTypeTag,
        });
      }
    });
    return map;
  }, [userRoles]);

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

  const membershipById = useMemo(() => {
    const map = new Map<string, MembershipCommunity>();
    (membershipData ?? []).forEach((c) => map.set(c.id, c));
    return map;
  }, [membershipData]);

  const { communities: batchCommunities, isLoading: memberCommunitiesLoading, isFetched: batchFetched } =
    useCommunitiesBatch(membershipCommunityIds);

  const batchById = useMemo(() => {
    const map = new Map<string, Community>();
    batchCommunities.forEach((c) => map.set(c.id, c));
    return map;
  }, [batchCommunities]);

  const communities = useMemo(() => {
    if (membershipCommunityIds.length === 0) {
      return [];
    }
    return membershipCommunityIds.map((id) =>
      mergeCommunityRecord(
        id,
        batchById.get(id),
        membershipById.get(id),
        roleMetaByCommunityId.get(id),
      ),
    );
  }, [membershipCommunityIds, batchById, membershipById, roleMetaByCommunityId]);

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
    wallets.forEach((wallet: { communityId?: string }) => {
      if (wallet?.communityId) {
        map.set(wallet.communityId, wallet);
      }
    });
    return map;
  }, [wallets]);

  // Combined loading state: wait for membership + roles; batch fetch is best-effort enrichment
  const isLoading =
    walletsLoading ||
    membershipLoading ||
    (membershipCommunityIds.length > 0 && !batchFetched && memberCommunitiesLoading);

  return {
    communities,
    communityIds,
    wallets,
    quotasMap,
    walletsMap,
    isLoading,
  };
}
