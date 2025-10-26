import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
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
    queryFn: async (): Promise<User> => {
      const response = await apiClient.get(`/api/v1/users/${userId}`);
      return response;
    },
    enabled: !!userId,
  });
};
