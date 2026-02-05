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
 * All users can create communities (teams).
 */
export function useCanCreateCommunity() {
  const { user } = useAuth();
  const { data: userRoles } = useUserRoles(user?.id || '');

  // All users can create communities (teams)
  const canCreate = true;

  return {
    canCreate,
    isLoading: !user || (!!user?.id && userRoles === undefined),
  };
}
