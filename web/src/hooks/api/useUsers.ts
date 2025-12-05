import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApiV1 } from '@/lib/api/v1';
import { queryKeys } from '@/lib/constants/queryKeys';
import type { User, PaginatedResponse } from '@/types/api-v1';

export const useUserProfile = (userId: string) => {
  return useQuery({
    queryKey: queryKeys.users.profile(userId),
    queryFn: () => usersApiV1.getUser(userId),
    enabled: !!userId, // userId is now expected to be internal ID
  });
};

export function useAllLeads(params: { page?: number; pageSize?: number } = {}) {
  return useQuery<PaginatedResponse<User>>({
    queryKey: [...queryKeys.users.all, 'leads', params],
    queryFn: () => usersApiV1.getAllLeads(params),
  });
}

export function useUpdatesFrequency() {
  return useQuery({
    queryKey: queryKeys.users.updatesFrequency(),
    queryFn: () => usersApiV1.getUpdatesFrequency(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

export function useSetUpdatesFrequency() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (frequency: string) => usersApiV1.setUpdatesFrequency(frequency),
    onSuccess: (data) => {
      // Update the cache with the new value
      queryClient.setQueryData(queryKeys.users.updatesFrequency(), data);
    },
    onError: (error) => {
      console.error('Failed to update frequency:', error);
    },
  });
}
