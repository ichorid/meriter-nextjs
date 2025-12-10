import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';

/**
 * Hook to check if current user can edit/delete a resource
 * Returns true if user is:
 * - A lead in the resource's community
 * - A superadmin
 * 
 * Authors cannot edit or delete their own comments - only admins can.
 * 
 * For delete: Non-admin authors (non-superadmin, non-lead) can only delete if there are no votes.
 * Leads and superadmins can always delete.
 */
export function useCanEditDelete(
  authorId: string | undefined,
  communityId: string | undefined,
  hasVotes: boolean = false
) {
  const { user } = useAuth();
  const { data: userRoles } = useUserRoles(user?.id || '');

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

  // Edit: Authors cannot edit their own comments - only admins can edit
  const canEdit = !!isAdmin;
  
  // Delete: Authors cannot delete their own comments - only admins can delete
  const canDelete = !!isAdmin;

  return {
    canEdit,
    canDelete,
    isAuthor: !!isAuthor,
    isLoading: !user || (!!user?.id && userRoles === undefined),
  };
}

