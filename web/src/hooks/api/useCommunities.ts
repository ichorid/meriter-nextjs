// Communities React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communitiesApiV1 } from '@/lib/api/v1';
import { queryKeys } from '@/lib/constants/queryKeys';
import type { UpdateCommunityDto } from '@meriter/shared-types';

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
