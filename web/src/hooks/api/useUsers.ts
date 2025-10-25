import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { queryKeys } from '@/lib/constants/queryKeys';
import type { User } from '@meriter/shared-types';

export const useUserProfile = (userId: string) => {
  return useQuery({
    queryKey: queryKeys.users.profile(userId),
    queryFn: async (): Promise<User> => {
      const response = await apiClient.get(`/api/v1/users/${userId}`);
      return response;
    },
    enabled: !!userId,
  });
};
