import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApiV1 } from '@/lib/api/v1';
import { queryKeys } from '@/lib/constants/queryKeys';

// Local User type definition
interface User {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  avatarUrl?: string;
  communityTags?: string[];
  profile?: {
    bio?: string;
    location?: string;
    website?: string;
    isVerified?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export const useUserProfile = (userId: string) => {
  return useQuery({
    queryKey: queryKeys.users.profile(userId),
    queryFn: () => usersApiV1.getUser(userId),
    enabled: !!userId, // userId is now expected to be internal ID
  });
};

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
