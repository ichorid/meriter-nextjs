import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from './api/useProfile';
import { useCommunity } from './api';

/**
 * Hook to check if user can create posts/polls in a community
 * Checks community posting rules and user roles (lead or superadmin only)
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
    let userRole: 'superadmin' | 'lead' | 'participant' | 'viewer' | null = null;
    
    // Check global superadmin role first
    if (user.globalRole === 'superadmin') {
      userRole = 'superadmin';
    } else {
      // Get role from UserCommunityRole
      const role = userRoles.find(r => r.communityId === communityId);
      if (role?.role) {
        userRole = role.role as 'lead' | 'participant' | 'viewer';
      } else if (community.adminIds?.includes(user.id)) {
        // Fallback: Check if user is in community adminIds (Legacy/Owner)
        userRole = 'lead';
      }
    }

    // Superadmin always can create (if they're in the allowed roles)
    if (userRole === 'superadmin') {
      const rules = community.postingRules;
      if (!rules) {
        // If no posting rules configured, allow superadmin
        return {
          canCreate: true,
          isLoading: false,
        };
      }
      if (rules.allowedRoles.includes('superadmin')) {
        return {
          canCreate: true,
          isLoading: false,
        };
      }
      return {
        canCreate: false,
        isLoading: false,
        reason: 'Superadmin role is not allowed to create content in this community',
      };
    }

    // Only lead and superadmin can create posts/polls
    // Check if user is lead
    if (userRole === 'lead') {
      const rules = community.postingRules;
      if (!rules) {
        // If no posting rules configured, allow lead (backward compatibility)
        return {
          canCreate: true,
          isLoading: false,
        };
      }
      if (rules.allowedRoles.includes('lead')) {
        return {
          canCreate: true,
          isLoading: false,
        };
      }
      return {
        canCreate: false,
        isLoading: false,
        reason: 'Team leads are not allowed to create content in this community',
      };
    }

    // User is participant or viewer, or has no role - cannot create
    return {
      canCreate: false,
      isLoading: false,
      reason: 'Only team leads and organizers can create posts and polls',
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



