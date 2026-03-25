'use client';

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCommunities } from '@/hooks/useUserCommunities';
import { useUserRoles } from '@/hooks/api/useProfile';

const PRIORITY_TYPE_TAGS = ['future-vision', 'marathon-of-good', 'team-projects', 'support'] as const;

export function useProjectParentCommunityChoices() {
  const { user } = useAuth();
  const { communities: allCommunities } = useUserCommunities();
  const { data: userRoles = [] } = useUserRoles(user?.id ?? '');

  return useMemo(() => {
    const privateOnly = allCommunities.filter(
      (c) => !PRIORITY_TYPE_TAGS.includes(c.typeTag as (typeof PRIORITY_TYPE_TAGS)[number]),
    );
    const leadIds = new Set(userRoles.filter((r) => r.role === 'lead').map((r) => r.communityId));
    const administeredCommunities = privateOnly.filter((c) => leadIds.has(c.id));
    const memberCommunities = privateOnly.filter((c) => !leadIds.has(c.id));
    return { administeredCommunities, memberCommunities };
  }, [allCommunities, userRoles]);
}
