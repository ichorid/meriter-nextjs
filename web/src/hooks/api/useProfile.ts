import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { profileApiV1, type UserCommunityRoleWithName, type PublicationWithCommunityName, type UpdateProfileData, type MeritStatsResponse } from '@/lib/api/v1/profile';
import type { PaginatedResponse, User } from '@/types/api-v1';
import { useAuth } from '@/contexts/AuthContext';
import { createGetNextPageParam } from '@/lib/utils/pagination-utils';
import { createMutation } from '@/lib/api/mutation-factory';

export function useUserRoles(userId: string) {
  return useQuery<UserCommunityRoleWithName[]>({
    queryKey: ['profile', 'roles', userId],
    queryFn: () => profileApiV1.getUserRoles(userId),
    enabled: !!userId,
  });
}

export function useUserProjects(userId: string, pageSize: number = 20) {
  return useInfiniteQuery<PaginatedResponse<PublicationWithCommunityName>>({
    queryKey: ['profile', 'projects', userId, pageSize],
    queryFn: ({ pageParam = 1 }) => profileApiV1.getUserProjects(userId, pageParam as number, pageSize),
    getNextPageParam: createGetNextPageParam<PublicationWithCommunityName>(),
    initialPageParam: 1,
    enabled: !!userId,
  });
}

export function useLeadCommunities(userId: string) {
  return useQuery({
    queryKey: ['profile', 'lead-communities', userId],
    queryFn: () => profileApiV1.getLeadCommunities(userId),
    enabled: !!userId,
  });
}

export const useUpdateProfile = createMutation<User, UpdateProfileData>({
    mutationFn: (data) => profileApiV1.updateProfile(data),
    errorContext: "Update profile error",
    onSuccess: (_result, _variables, queryClient) => {
        // Invalidate user queries to refetch updated data
        queryClient.invalidateQueries({ queryKey: ['user'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
});

// Alias for backwards compatibility
export const useUpdateUser = useUpdateProfile;

export function useMeritStats() {
  return useQuery<MeritStatsResponse>({
    queryKey: ['profile', 'merit-stats'],
    queryFn: () => profileApiV1.getMeritStats(),
  });
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
