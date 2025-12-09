import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';

/**
 * Hook to check if current user can edit/delete a resource
 * Returns true if user is:
 * - The author of the resource
 * - A lead in the resource's community
 * - A superadmin
 */
export function useCanEditDelete(
  authorId: string | undefined,
  communityId: string | undefined
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

  const canEdit = !!(isAuthor || isSuperadmin || isLeadInCommunity);
  const canDelete = !!(isAuthor || isSuperadmin || isLeadInCommunity);

  return {
    canEdit,
    canDelete,
    isAuthor: !!isAuthor,
    isLoading: !user || (!!user?.id && userRoles === undefined),
  };
}

