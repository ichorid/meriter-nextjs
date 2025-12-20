import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';

/**
 * Hook to check if the current user can view another user's merits/quota in a specific community.
 * 
 * Returns true if:
 * - Current user is a superadmin (can view any user in any community)
 * - Current user is a lead in the specified community (can view any user in that community)
 * 
 * @param communityId - The community ID to check permissions for
 * @returns { canView: boolean; isLoading: boolean }
 */
export function useCanViewUserMerits(communityId?: string) {
  const { user, isLoading: authLoading } = useAuth();
  const { data: userRoles = [], isLoading: rolesLoading } = useUserRoles(user?.id || '');

  const canView = useMemo(() => {
    if (!user || !communityId) return false;

    // Superadmin can view any user's merits in any community
    if (user.globalRole === 'superadmin') {
      return true;
    }

    // Check if user is a lead in this community
    const isLeadInCommunity = userRoles.some(
      (role) => role.communityId === communityId && role.role === 'lead'
    );

    return isLeadInCommunity;
  }, [user, communityId, userRoles]);

  return {
    canView,
    isLoading: authLoading || rolesLoading,
  };
}

