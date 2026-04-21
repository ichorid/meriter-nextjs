'use client';

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCanViewUserMerits } from '@/hooks/useCanViewUserMerits';
import { routes } from '@/lib/constants/routes';

const PRIORITY_TYPE_TAGS = ['marathon-of-good', 'future-vision', 'team-projects', 'support'] as const;

export type ProfileMeritsLedgerRole = {
  id: string;
  communityId: string;
  communityName?: string;
  communityTypeTag?: string;
  role: string;
};

/**
 * Shared rules for profile merit balance visibility and merit-history deep links.
 */
export function useProfileMeritsLedgerModel(
  userId: string,
  communityIds: string[],
  userRoles: ProfileMeritsLedgerRole[],
) {
  const { user: me } = useAuth();

  const priorityRoles = useMemo(
    () =>
      userRoles.filter(
        (r) =>
          r.communityTypeTag &&
          PRIORITY_TYPE_TAGS.includes(r.communityTypeTag as (typeof PRIORITY_TYPE_TAGS)[number]),
      ),
    [userRoles],
  );

  const hasPriority = priorityRoles.length > 0;
  const firstPriorityId = priorityRoles[0]?.communityId;
  const { canView: canViewGlobal } = useCanViewUserMerits(firstPriorityId ?? undefined);
  const showGlobalMeritBlock = Boolean(hasPriority && canViewGlobal && firstPriorityId);

  const meritHistoryHref = useMemo(() => {
    if (!me?.id) return null;
    if (me.id === userId) {
      return routes.profileMeritTransfers;
    }
    if (me.globalRole === 'superadmin') {
      const ctx = firstPriorityId || communityIds[0] || 'viewer';
      return routes.userMeritHistory(userId, ctx);
    }
    if (hasPriority && canViewGlobal && firstPriorityId) {
      return routes.userMeritHistory(userId, firstPriorityId);
    }
    return null;
  }, [me?.id, me?.globalRole, userId, hasPriority, canViewGlobal, firstPriorityId, communityIds]);

  const showHeroMerits = Boolean(
    me?.id && (meritHistoryHref != null || showGlobalMeritBlock),
  );

  return {
    meritHistoryHref,
    showGlobalMeritBlock,
    walletCommunityId: firstPriorityId as string | undefined,
    showHeroMerits,
  };
}
