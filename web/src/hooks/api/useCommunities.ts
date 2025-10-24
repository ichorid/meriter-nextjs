// Communities React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communitiesApi } from '@/lib/api';
import type { Community, CommunityCreate } from '@/types/entities';
import type { GetCommunitiesRequest } from '@/types/api';

// Query keys
export const communitiesKeys = {
  all: ['communities'] as const,
  lists: () => [...communitiesKeys.all, 'list'] as const,
  list: (params: GetCommunitiesRequest) => [...communitiesKeys.lists(), params] as const,
  details: () => [...communitiesKeys.all, 'detail'] as const,
  detail: (id: string) => [...communitiesKeys.details(), id] as const,
  info: (chatId: string) => [...communitiesKeys.all, 'info', chatId] as const,
  userProfile: (tgUserId: string) => [...communitiesKeys.all, 'userProfile', tgUserId] as const,
  rate: (fromCurrency: string) => [...communitiesKeys.all, 'rate', fromCurrency] as const,
} as const;

// Get communities with pagination
export function useCommunities(params: GetCommunitiesRequest = {}) {
  return useQuery({
    queryKey: communitiesKeys.list(params),
    queryFn: () => communitiesApi.getCommunities(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get single community
export function useCommunity(id: string) {
  return useQuery({
    queryKey: communitiesKeys.detail(id),
    queryFn: () => communitiesApi.getCommunity(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!id,
  });
}

// Get community info by chat ID
export function useCommunityInfo(chatId: string) {
  return useQuery({
    queryKey: communitiesKeys.info(chatId),
    queryFn: () => communitiesApi.getCommunityInfo(chatId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!chatId,
  });
}

// Get user profile by Telegram ID
export function useUserProfile(tgUserId: string) {
  return useQuery({
    queryKey: communitiesKeys.userProfile(tgUserId),
    queryFn: () => communitiesApi.getUserProfile(tgUserId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!tgUserId,
  });
}

// Get exchange rate
export function useRate(fromCurrency: string) {
  return useQuery({
    queryKey: communitiesKeys.rate(fromCurrency),
    queryFn: () => communitiesApi.getRate(fromCurrency),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!fromCurrency,
  });
}

// Create community
export function useCreateCommunity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CommunityCreate) => communitiesApi.createCommunity(data),
    onSuccess: (newCommunity) => {
      // Invalidate and refetch communities lists
      queryClient.invalidateQueries({ queryKey: communitiesKeys.lists() });
      
      // Add the new community to cache
      queryClient.setQueryData(communitiesKeys.detail(newCommunity._id), newCommunity);
    },
    onError: (error) => {
      console.error('Create community error:', error);
    },
  });
}

// Update community
export function useUpdateCommunity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CommunityCreate> }) => 
      communitiesApi.updateCommunity(id, data),
    onSuccess: (updatedCommunity) => {
      // Update the community in cache
      queryClient.setQueryData(communitiesKeys.detail(updatedCommunity._id), updatedCommunity);
      
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: communitiesKeys.lists() });
      
      // Also invalidate community info cache
      queryClient.invalidateQueries({ 
        queryKey: communitiesKeys.info(updatedCommunity.chatId) 
      });
    },
    onError: (error) => {
      console.error('Update community error:', error);
    },
  });
}

// Delete community
export function useDeleteCommunity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => communitiesApi.deleteCommunity(id),
    onSuccess: (_, deletedId) => {
      // Remove from all caches
      queryClient.removeQueries({ queryKey: communitiesKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: communitiesKeys.lists() });
    },
    onError: (error) => {
      console.error('Delete community error:', error);
    },
  });
}
