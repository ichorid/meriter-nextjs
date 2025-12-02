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

    // Get voting rules from community
    const rules = community.votingRules;
    if (!rules) {
      // Fallback: if no rules configured, allow everyone (backward compatibility)
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

    // Check if participants cannot vote for lead posts
    if (rules.participantsCannotVoteForLead && userRole === 'participant' && authorId) {
      // Need to check author's role - if we don't have it, we can't determine
      // For now, allow it and let backend handle the check
      // This could be optimized by fetching author's role, but that's expensive
    }

    // Additional check: For Good Deeds Marathon, Members (participants) cannot vote for Representative (lead) posts
    if (
      community.typeTag === 'marathon-of-good' &&
      userRole === 'participant' &&
      authorId
    ) {
      // Similar to above - would need author's role to check
      // Let backend handle this check
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

