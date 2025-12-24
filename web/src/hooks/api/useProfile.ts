import { trpc } from '@/lib/trpc/client';
import type { User } from '@/types/api-v1';
import { useAuth } from '@/contexts/AuthContext';

export function useUserRoles(userId: string) {
  return trpc.users.getUserRoles.useQuery(
    { userId },
    {
      enabled: !!userId,
    },
  );
}

export function useUserProjects(userId: string, pageSize: number = 20) {
  return trpc.users.getUserProjects.useInfiniteQuery(
    {
      userId,
      pageSize,
    },
    {
      getNextPageParam: (lastPage) => {
        if (lastPage.pagination.hasNext) {
          return lastPage.pagination.page + 1;
        }
        return undefined;
      },
      initialPageParam: 1,
      enabled: !!userId,
    },
  );
}

export function useLeadCommunities(userId: string) {
  return trpc.users.getLeadCommunities.useQuery(
    { userId },
    {
      enabled: !!userId,
    },
  );
}

export function useUpdateProfile() {
  const utils = trpc.useUtils();
  
  return trpc.users.updateProfile.useMutation({
    onSuccess: () => {
      // Invalidate user queries to refetch updated data
      utils.users.getMe.invalidate();
      utils.users.getUserProfile.invalidate();
      utils.users.getUserRoles.invalidate();
    },
  });
}

// Alias for backwards compatibility
export const useUpdateUser = useUpdateProfile;

export function useMeritStats() {
  return trpc.users.getMeritStats.useQuery();
}

/**
 * Hook to check if the current user can create communities.
 * Only organizers (superadmin) and leads (representatives) can create communities.
 * Viewers cannot create communities.
 */
export function useCanCreateCommunity() {
  const { user } = useAuth();
  const { data: userRoles } = useUserRoles(user?.id || '');

  // Check if user has viewer role in any community
  const hasViewerRole = userRoles?.some(role => role.role === 'viewer') ?? false;
  
  // Viewers cannot create communities
  if (hasViewerRole) {
    return {
      canCreate: false,
      isLoading: !user || (!!user?.id && userRoles === undefined),
    };
  }

  const canCreate = user?.globalRole === 'superadmin' || 
    (userRoles?.some(role => role.role === 'lead') ?? false);

  return {
    canCreate,
    isLoading: !user || (!!user?.id && userRoles === undefined),
  };
}
