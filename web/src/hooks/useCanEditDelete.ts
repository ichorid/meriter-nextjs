import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useCommunity } from '@/hooks/api/useCommunities';

/**
 * Hook to check if current user can edit/delete a resource
 * 
 * Edit permissions:
 * - Authors can edit their own posts/comments if:
 *   - Zero votes AND
 *   - Within edit window (from community settings, default 7 days)
 * - Leads can edit any post/comment in their community (no restrictions)
 * - Superadmins can edit any post/comment (no restrictions)
 * 
 * Delete permissions:
 * - Authors can delete their own posts/comments if no votes
 * - Leads can delete any post/comment in their community
 * - Superadmins can delete any post/comment
 */
export function useCanEditDelete(
  authorId: string | undefined,
  communityId: string | undefined,
  hasVotes: boolean = false,
  createdAt?: string | Date
) {
  const { user } = useAuth();
  const { data: userRoles } = useUserRoles(user?.id || '');
  const { data: community } = useCommunity(communityId || '');

  // Check if user is the author
  const isAuthor = user?.id && authorId && user.id === authorId;

  // Check if user is superadmin
  const isSuperadmin = user?.globalRole === 'superadmin';

  // Check if user is a lead in this community
  const isLeadInCommunity = userRoles?.some(
    (role) => role.role === 'lead' && role.communityId === communityId
  ) ?? false;

  // Check if user is admin (superadmin or lead)
  const isAdmin = isSuperadmin || isLeadInCommunity;

  // Check if within edit window (for authors only)
  const editWindowDays = community?.settings?.editWindowDays ?? 7;
  let isWithinEditWindow = true;
  if (createdAt && editWindowDays > 0) {
    const createdDate = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    const now = new Date();
    const daysSinceCreation = Math.floor(
      (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    isWithinEditWindow = daysSinceCreation <= editWindowDays;
  }

  // Edit: Authors can edit if zero votes and within time window, admins can always edit
  const canEdit = isAdmin || (isAuthor && !hasVotes && isWithinEditWindow);
  const canEditEnabled = isAdmin || (isAuthor && !hasVotes && isWithinEditWindow);
  
  // Delete: Authors can delete if no votes, admins can always delete
  const canDelete = isAdmin || (isAuthor && !hasVotes);

  return {
    canEdit,
    canEditEnabled,
    canDelete,
    isAuthor: !!isAuthor,
    isAdmin: !!isAdmin,
    isLoading: !user || (!!user?.id && userRoles === undefined) || (!!communityId && community === undefined),
  };
}

