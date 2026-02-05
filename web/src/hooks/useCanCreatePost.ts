import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from './api/useProfile';
import { useCommunity } from './api';
import type { PermissionRule } from '@/types/api-v1';

const POST_PUBLICATION_ACTION = 'post_publication';

/**
 * Helper function to check if a role has permission for an action
 */
function hasPermissionForAction(
  rules: PermissionRule[],
  role: 'superadmin' | 'lead' | 'participant',
  action: string
): boolean {
  const rule = rules.find(r => r.role === role && r.action === action);
  return rule?.allowed ?? false;
}

/**
 * Hook to check if user can create posts/polls in a community
 * Checks community permissionRules for POST_PUBLICATION action.
 */
export function useCanCreatePost(communityId?: string): {
  canCreate: boolean;
  isLoading: boolean;
  reason?: string;
} {
  const { user } = useAuth();
  const { data: userRoles = [], isLoading: rolesLoading } = useUserRoles(user?.id || '');
  const { data: community, isLoading: communityLoading } = useCommunity(communityId || '');

  return useMemo(() => {
    // Loading state
    if (rolesLoading || communityLoading || !user?.id) {
      return {
        canCreate: false,
        isLoading: true,
      };
    }

    // If no user, cannot create
    if (!user?.id) {
      return {
        canCreate: false,
        isLoading: false,
        reason: 'You must be logged in to create content',
      };
    }

    // If no community, cannot determine permissions - default to false for safety
    if (!community || !communityId) {
      return {
        canCreate: false,
        isLoading: false,
        reason: 'Community not found',
      };
    }

    // Get user's role in the community
    let userRole: 'superadmin' | 'lead' | 'participant' | null = null;
    
    // Check global superadmin role first
    if (user.globalRole === 'superadmin') {
      userRole = 'superadmin';
    } else {
      // Get role from UserCommunityRole
      const role = userRoles.find(r => r.communityId === communityId);
      if (role?.role && role.role !== 'viewer') {
        userRole = role.role as 'lead' | 'participant';
      }
    }

    // Get permission rules (effective rules from community)
    const permissionRules = community.permissionRules || [];

    // Check if user role has permission for POST_PUBLICATION
    if (userRole && hasPermissionForAction(permissionRules, userRole, POST_PUBLICATION_ACTION)) {
      return {
        canCreate: true,
        isLoading: false,
      };
    }

    // User has no role or doesn't have permission
    if (!userRole) {
      return {
        canCreate: false,
        isLoading: false,
        reason: 'You must be a member of this community to create content',
      };
    }

    return {
      canCreate: false,
      isLoading: false,
      reason: `${userRole === 'participant' ? 'Participants' : 'Users'} are not allowed to create content in this community`,
    };
  }, [
    user?.id,
    user?.globalRole,
    userRoles,
    community,
    communityId,
    rolesLoading,
    communityLoading,
  ]);
}
