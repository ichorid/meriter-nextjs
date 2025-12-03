import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from './api/useProfile';
import { useCommunity } from './api';

/**
 * Hook to check if user can vote on a publication or comment
 * Checks community voting rules, user roles, and mutual exclusivity
 */
export function useCanVote(
  targetId: string,
  targetType: 'publication' | 'comment',
  communityId?: string,
  authorId?: string,
  isAuthor?: boolean,
  isBeneficiary?: boolean,
  hasBeneficiary?: boolean,
  isProject?: boolean
): boolean {
  const { user } = useAuth();
  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const { data: community } = useCommunity(communityId || '');

  return useMemo(() => {
    // If no user, cannot vote
    if (!user?.id) return false;

    // Project posts cannot be voted on (handled separately, but check here too)
    if (isProject) return false;

    // Mutual exclusivity: Cannot vote if user is the effective beneficiary
    // (already checked via isBeneficiary prop, but double-check)
    if (isBeneficiary) return false;
    if (isAuthor && !hasBeneficiary) return false;

    // If no community, cannot determine permissions - default to false for safety
    if (!community || !communityId) return false;

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

    // Superadmin always can vote
    if (userRole === 'superadmin') return true;

    // Check if this is a team community (typeTag === 'team')
    // In team communities, only team members can vote, and they can't vote for themselves
    if (community.typeTag === 'team') {
      // Cannot vote for own post in team community
      if (isAuthor && authorId === user.id) {
        return false;
      }
      // Note: Team membership check is handled by backend
      // Frontend allows the vote attempt, backend will validate team membership
    }

    // Get voting rules from community
    const rules = community.votingRules;
    if (!rules) {
      // Fallback: if no rules configured, allow everyone (backward compatibility)
      return true;
    }

    // For participants in marathon-of-good communities: allow voting regardless of allowedRoles
    // This check must happen BEFORE the allowedRoles check to ensure participants can always vote
    // Note: Team-based checks (same team, different team) are handled by backend
    // Frontend can only check community typeTag
    if (userRole === 'participant' && community.typeTag === 'marathon-of-good') {
      // Allow participants to vote - backend will validate:
      // - Cannot vote for participants from marathon/vision communities
      // - Cannot vote for leads from their own team
      // - Can vote for leads from other teams
      return true;
    }

    // Check if role is allowed
    if (!rules.allowedRoles.includes(userRole as any)) {
      return false;
    }

    // Check if voting for own post is allowed
    if (isAuthor && authorId === user.id && !rules.canVoteForOwnPosts) {
      return false;
    }

    // For viewers: Only allow voting in marathon-of-good communities
    if (userRole === 'viewer') {
      if (community.typeTag !== 'marathon-of-good') {
        return false; // Viewers can only vote in marathon-of-good communities
      }
      // Viewers can vote in marathon-of-good (already checked own posts above)
      return true;
    }

    return true;
  }, [
    user?.id,
    user?.globalRole,
    userRoles,
    community,
    communityId,
    authorId,
    isAuthor,
    isBeneficiary,
    hasBeneficiary,
    isProject,
  ]);
}

