// Communities React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communitiesApiV1 } from '@/lib/api/v1';
import { communitiesApiV1Enhanced } from '@/lib/api/v1';
import { queryKeys } from '@/lib/constants/queryKeys';

// Local type definition
interface UpdateCommunityDto {
  name?: string;
  description?: string;
  avatarUrl?: string;
  isActive?: boolean;
  settings?: {
    iconUrl?: string;
    currencyNames?: { singular: string; plural: string; genitive: string };
    dailyEmission?: number;
  };
  hashtags?: string[];
  hashtagDescriptions?: Record<string, string>;
}

export const useCommunities = () => {
  return useQuery({
    queryKey: queryKeys.communities.list({}),
    queryFn: () => communitiesApiV1.getCommunities(),
  });
};

export const useCommunity = (id: string) => {
  return useQuery({
    queryKey: queryKeys.communities.detail(id),
    queryFn: () => communitiesApiV1.getCommunity(id),
    enabled: !!id,
  });
};

export const useUpdateCommunity = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UpdateCommunityDto> }) => 
      communitiesApiV1.updateCommunity(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.all });
    },
  });
};

export const useSyncCommunities = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => communitiesApiV1Enhanced.syncCommunities(),
    onSuccess: () => {
      // Invalidate wallets query since wallets are used to display communities on home page
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.wallets() });
      // Invalidate user communities query if any hook uses it
      queryClient.invalidateQueries({ queryKey: ['user-communities'] });
      // Invalidate user query to refresh user data
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
    },
    onError: (error) => {
      console.error('Sync communities error:', error);
    },
  });
};

export const useSendCommunityMemo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (communityId: string) => communitiesApiV1.sendUsageMemo(communityId),
    onSuccess: () => {
      // nothing to invalidate specifically; keep for consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.all });
    },
  });
};
