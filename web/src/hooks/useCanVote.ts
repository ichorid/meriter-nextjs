import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from './api/useProfile';
import { useCommunity } from './api';
import type { CommunityWithComputedFields } from '@/types/api-v1';

/**
 * Hook to check if user can vote on a publication or comment
 * Checks community voting rules, user roles, and mutual exclusivity
 * 
 * @deprecated This hook is deprecated. Use API permissions from publication.permissions or comment.permissions instead.
 * Permissions are now calculated server-side and embedded in API responses.
 * This hook will be removed in a future major version.
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
): { canVote: boolean; reason?: string } {
  // Deprecation warning
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      'useCanVote is deprecated. Use API permissions from publication.permissions or comment.permissions instead. ' +
      'Permissions are now calculated server-side and embedded in API responses.'
    );
  }

  const { user } = useAuth();
  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const { data: community } = useCommunity(communityId || '');

  return useMemo(() => {
    // If no user, cannot vote
    if (!user?.id) {
      return { canVote: false, reason: 'voteDisabled.notLoggedIn' };
    }

    // Project posts cannot be voted on (handled separately, but check here too)
    if (isProject) {
      return { canVote: false, reason: 'voteDisabled.projectPost' };
    }

    // If no community, cannot determine permissions - default to false for safety
    if (!community || !communityId) {
      return { canVote: false, reason: 'voteDisabled.noCommunity' };
    }

    // Get user's role in the community (needed for future-vision self-voting check)
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

    // Exception: Allow self-voting in future-vision groups for participants/leads/superadmins
    // Effective beneficiary = beneficiary if set, otherwise author
    // Allow voting if user is the effective beneficiary in a future-vision group
    const isEffectiveBeneficiary = isBeneficiary || (isAuthor && !hasBeneficiary);
    const isFutureVisionSelfVoting = community.typeTag === 'future-vision' && 
      (userRole === 'participant' || userRole === 'lead' || userRole === 'superadmin') &&
      isEffectiveBeneficiary;
    
    // Superadmin always can vote (check before mutual exclusivity)
    if (userRole === 'superadmin') {
      return { canVote: true };
    }

    // Check if this is a team community (typeTag === 'team')
    // In team communities, only team members can vote, and they can't vote for themselves
    // This check must happen before the general mutual exclusivity check
    if (community.typeTag === 'team') {
      // Cannot vote for own post in team community
      if (isAuthor && authorId === user.id) {
        return { canVote: false, reason: 'voteDisabled.teamOwnPost' };
      }
      // Note: Team membership check is handled by backend
      // Frontend allows the vote attempt, backend will validate team membership
    }
    
    if (isFutureVisionSelfVoting) {
      // Allow self-voting in future-vision group - skip mutual exclusivity check
      // Continue to other checks below (role checks, etc.)
    } else {
      // Mutual exclusivity: Cannot vote if user is the effective beneficiary
      // (already checked via isBeneficiary prop, but double-check)
      if (isBeneficiary) {
        return { canVote: false, reason: 'voteDisabled.isBeneficiary' };
      }
      if (isAuthor && !hasBeneficiary) {
        return { canVote: false, reason: 'voteDisabled.isAuthor' };
      }
    }

    // Get voting rules from community
    const rules = community.votingRules;
    if (!rules) {
      // Fallback: if no rules configured, allow everyone (backward compatibility)
      return { canVote: true };
    }

    // For participants in marathon-of-good communities: allow voting regardless of allowedRoles
    // This check must happen BEFORE the allowedRoles check to ensure participants can always vote
    // Note: Team-based checks (same team, different team) are handled by backend
    // Frontend can only check community typeTag
    if (userRole === 'participant' && community.typeTag === 'marathon-of-good') {
      // Allow participants to vote - backend will validate:
      // - Cannot vote for leads from their own team
      // - Can vote for leads from other teams
      // - Can vote for participants (per MARATHON_OF_GOOD.md)
      return { canVote: true };
    }

    // Check if role is allowed
    if (!userRole || !rules.allowedRoles.includes(userRole)) {
      return { canVote: false, reason: 'voteDisabled.roleNotAllowed' };
    }

    // Check if voting for own post is allowed
    // Exception: Skip this check for future-vision groups (self-voting already handled above)
    if (!isFutureVisionSelfVoting && isAuthor && authorId === user.id && !rules.canVoteForOwnPosts) {
      return { canVote: false, reason: 'voteDisabled.ownPostNotAllowed' };
    }

    // For viewers: Only allow voting in marathon-of-good communities
    if (userRole === 'viewer') {
      if (community.typeTag !== 'marathon-of-good') {
        return { canVote: false, reason: 'voteDisabled.viewerNotMarathon' };
      }
      // Viewers can vote in marathon-of-good (already checked own posts above)
      return { canVote: true };
    }

    return { canVote: true };
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

