// Publications React Query hooks
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { publicationsApi } from '@/lib/api';
import type { Publication, PublicationCreate } from '@/types/entities';
import type { GetPublicationsRequest } from '@/types/api';

// Query keys
export const publicationsKeys = {
  all: ['publications'] as const,
  lists: () => [...publicationsKeys.all, 'list'] as const,
  list: (params: GetPublicationsRequest) => [...publicationsKeys.lists(), params] as const,
  details: () => [...publicationsKeys.all, 'detail'] as const,
  detail: (slug: string) => [...publicationsKeys.details(), slug] as const,
  my: () => [...publicationsKeys.all, 'my'] as const,
  byCommunity: (chatId: string) => [...publicationsKeys.all, 'community', chatId] as const,
} as const;

// Get publications with pagination
export function usePublications(params: GetPublicationsRequest = {}) {
  return useQuery({
    queryKey: publicationsKeys.list(params),
    queryFn: () => publicationsApi.getPublications(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get publications with infinite scroll
export function useInfinitePublications(params: Omit<GetPublicationsRequest, 'skip' | 'limit'> = {}) {
  return useInfiniteQuery({
    queryKey: [...publicationsKeys.lists(), params],
    queryFn: ({ pageParam = 0 }) => 
      publicationsApi.getPublications({ ...params, skip: pageParam * 10, limit: 10 }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.data.length < 10) return undefined;
      return allPages.length * 10;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get user's publications
export function useMyPublications(params: { skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: [...publicationsKeys.my(), params],
    queryFn: () => publicationsApi.getMyPublications(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get publications by community with infinite scroll
export function useInfinitePublicationsByCommunity(
  chatId: string, 
  params: Omit<GetPublicationsRequest, 'skip' | 'limit'> = {}
) {
  return useInfiniteQuery({
    queryKey: [...publicationsKeys.byCommunity(chatId), params],
    queryFn: ({ pageParam = 0 }) => 
      publicationsApi.getPublicationsByCommunity(chatId, { ...params, skip: pageParam * 5, limit: 5 }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.data.length < 5) return undefined;
      return allPages.length * 5;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!chatId,
  });
}

// Get single publication
export function usePublication(slug: string) {
  return useQuery({
    queryKey: publicationsKeys.detail(slug),
    queryFn: () => publicationsApi.getPublication(slug),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!slug,
  });
}

// Create publication
export function useCreatePublication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: PublicationCreate) => publicationsApi.createPublication(data),
    onSuccess: (newPublication) => {
      // Invalidate and refetch publications lists
      queryClient.invalidateQueries({ queryKey: publicationsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: publicationsKeys.my() });
      
      // Add the new publication to relevant caches
      queryClient.setQueryData(publicationsKeys.detail(newPublication.slug), newPublication);
    },
    onError: (error) => {
      console.error('Create publication error:', error);
    },
  });
}

// Update publication
export function useUpdatePublication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PublicationCreate> }) => 
      publicationsApi.updatePublication(id, data),
    onSuccess: (updatedPublication) => {
      // Update the publication in cache
      queryClient.setQueryData(publicationsKeys.detail(updatedPublication.slug), updatedPublication);
      
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: publicationsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: publicationsKeys.my() });
    },
    onError: (error) => {
      console.error('Update publication error:', error);
    },
  });
}

// Delete publication
export function useDeletePublication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => publicationsApi.deletePublication(id),
    onSuccess: (_, deletedId) => {
      // Remove from all caches
      queryClient.removeQueries({ queryKey: publicationsKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: publicationsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: publicationsKeys.my() });
    },
    onError: (error) => {
      console.error('Delete publication error:', error);
    },
  });
}
