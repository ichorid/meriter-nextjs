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
      // Invalidate user communities and user queries to refresh the home page
      queryClient.invalidateQueries({ queryKey: ['user-communities'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: (error) => {
      console.error('Sync communities error:', error);
    },
  });
};
