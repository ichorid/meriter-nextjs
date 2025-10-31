// Publications React Query hooks with Zod validation
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { publicationsApiV1, communitiesApiV1 } from '@/lib/api/v1';
import { queryKeys } from '@/lib/constants/queryKeys';
import { useValidatedQuery, useValidatedMutation } from '@/lib/api/validated-query';
import { PublicationSchema, CreatePublicationDtoSchema } from '@/types/api-v1';
import type { Publication, PaginatedResponse, CreatePublicationDto } from '@/types/api-v1';

interface ListQueryParams {
  skip?: number;
  limit?: number;
  type?: string;
  communityId?: string;
  userId?: string;
  tag?: string;
  sort?: string;
  order?: string;
}

export function usePublications(params: ListQueryParams = {}) {
  return useQuery({
    queryKey: queryKeys.publications.list(params),
    queryFn: () => publicationsApiV1.getPublications(params),
  });
}

export function useMyPublications(params: { skip?: number; limit?: number; userId?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.publications.myPublications(params),
    queryFn: async () => {
      // If userId is provided, use the publications endpoint with authorId query param
      if (params.userId) {
        return publicationsApiV1.getPublications({ 
          skip: params.skip, 
          limit: params.limit,
          userId: params.userId 
        });
      } else {
        // Try to use /api/v1/users/me/publications endpoint (may not exist)
        // Fallback: return empty array if no userId provided
        try {
          return await publicationsApiV1.getMyPublications({ skip: params.skip, limit: params.limit });
        } catch (error) {
          console.warn('getMyPublications failed, returning empty array:', error);
          return [];
        }
      }
    },
    enabled: !!params.userId, // Only enable if userId is provided
  });
}

export function usePublication(id: string) {
  return useValidatedQuery({
    queryKey: queryKeys.publications.detail(id),
    queryFn: () => publicationsApiV1.getPublication(id),
    schema: PublicationSchema,
    context: `usePublication(${id})`,
    enabled: !!id,
  });
}

export function useInfinitePublicationsByCommunity(
  communityId: string,
  params: { pageSize?: number; sort?: string; order?: string } = {}
) {
  const { pageSize = 5, sort = 'score', order = 'desc' } = params;
  
  return useInfiniteQuery({
    queryKey: queryKeys.publications.byCommunityInfinite(communityId, params),
    queryFn: ({ pageParam }: { pageParam: number }) => {
      return communitiesApiV1.getCommunityPublications(communityId, {
        page: pageParam,
        pageSize,
        sort,
        order,
      });
    },
    getNextPageParam: (lastPage: PaginatedResponse<Publication>) => {
      if (!lastPage.meta?.pagination?.hasNext) {
        return undefined;
      }
      return (lastPage.meta.pagination.page || 1) + 1;
    },
    initialPageParam: 1,
    enabled: !!communityId, // Ensure query only runs when communityId is available
  });
}

export function useCreatePublication() {
  const queryClient = useQueryClient();
  
  return useValidatedMutation({
    mutationFn: (data: CreatePublicationDto) => publicationsApiV1.createPublication(data),
    inputSchema: CreatePublicationDtoSchema,
    outputSchema: PublicationSchema,
    context: 'useCreatePublication',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.publications.lists() });
    },
  });
}

export function useDeletePublication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => publicationsApiV1.deletePublication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.publications.lists() });
    },
  });
}
