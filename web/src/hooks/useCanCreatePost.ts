import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from './api/useProfile';
import { useCommunity } from './api';

/**
 * Hook to check if user can create posts/polls in a community
 * Checks community posting rules and user roles.
 * Participants can create posts in marathon-of-good and future-vision communities.
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

    // Check if participant or viewer can create based on postingRules
    if (userRole === 'participant' || userRole === 'viewer') {
      const rules = community.postingRules;
      
      // Special handling for marathon-of-good, future-vision, and support communities
      // According to MARATHON_OF_GOOD.md, participants can post in these communities
      // Support communities also allow participants to post (backend allows: superadmin, lead, participant)
      const isSpecialCommunity = community.typeTag === 'marathon-of-good' || community.typeTag === 'future-vision' || community.typeTag === 'support';
      
      if (userRole === 'participant' && isSpecialCommunity) {
        // Participants can always post in marathon-of-good, future-vision, and support communities
        // This matches the documented behavior and backend implementation
        return {
          canCreate: true,
          isLoading: false,
        };
      }
      
      if (!rules) {
        // If no posting rules configured, don't allow (backward compatibility)
        return {
          canCreate: false,
          isLoading: false,
          reason: 'Only team leads and organizers can create posts and polls',
        };
      }
      if (rules.allowedRoles.includes(userRole)) {
        return {
          canCreate: true,
          isLoading: false,
        };
      }
      return {
        canCreate: false,
        isLoading: false,
        reason: `${userRole === 'participant' ? 'Participants' : 'Viewers'} are not allowed to create content in this community`,
      };
    }

    // User has no role - cannot create
    return {
      canCreate: false,
      isLoading: false,
      reason: 'You must be a member of this community to create content',
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



