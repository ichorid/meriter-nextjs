import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useCommunity } from '@/hooks/api/useCommunities';

/**
 * Hook to check if current user can edit/delete a resource
 * 
 * Edit permissions:
 * - Authors can edit their own posts/comments if:
 *   - Zero votes AND zero comments AND
 *   - Within edit window (from community settings, default 7 days)
 * - Leads can edit any post/comment in their community (no restrictions)
 * - Superadmins can edit any post/comment (no restrictions)
 * 
 * Delete permissions:
 * - Authors can delete their own posts/comments if no votes and no comments
 * - Leads can delete any post/comment in their community
 * - Superadmins can delete any post/comment
 * 
 * @deprecated This hook is deprecated. Use API permissions from publication.permissions or comment.permissions instead.
 * Permissions are now calculated server-side and embedded in API responses.
 * This hook will be removed in a future major version.
 */
export function useCanEditDelete(
  authorId: string | undefined,
  communityId: string | undefined,
  hasVotes: boolean = false,
  createdAt?: string | Date,
  hasComments: boolean = false
) {
  // Deprecation warning
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      'useCanEditDelete is deprecated. Use API permissions from publication.permissions or comment.permissions instead. ' +
      'Permissions are now calculated server-side and embedded in API responses.'
    );
  }

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

  // Check if post has votes or comments (frozen state)
  const isFrozen = hasVotes || hasComments;
  
  // Edit: Show button if admin or author, but enable only if not frozen and within time window
  // This allows buttons to be visible but disabled when frozen
  const canEdit = isAdmin || isAuthor;
  const canEditEnabled = isAdmin || (isAuthor && !isFrozen && isWithinEditWindow);
  
  // Delete: Show button if admin or author, but enable only if not frozen
  // This allows buttons to be visible but disabled when frozen
  const canDelete = isAdmin || isAuthor;
  const canDeleteEnabled = isAdmin || (isAuthor && !isFrozen);

  return {
    canEdit,
    canEditEnabled,
    canDelete,
    canDeleteEnabled,
    isAuthor: !!isAuthor,
    isAdmin: !!isAdmin,
    isLoading: !user || (!!user?.id && userRoles === undefined) || (!!communityId && community === undefined),
  };
}

