// Publications React Query hooks with Zod validation
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { publicationsApiV1 } from '@/lib/api/v1';
import { queryKeys } from '@/lib/constants/queryKeys';

// Local type definitions
interface Publication {
  id: string;
  title: string;
  content: string;
  authorId: string;
  communityId: string;
  type: 'text' | 'image' | 'video';
  imageUrl?: string;
  videoUrl?: string;
  hashtags?: string[];
  createdAt: string;
  updatedAt: string;
  metrics?: {
    score: number;
    commentCount: number;
  };
}

interface CreatePublicationDto {
  title: string;
  content: string;
  communityId: string;
  type: 'text' | 'image' | 'video';
  imageUrl?: string;
  videoUrl?: string;
  hashtags?: string[];
}

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

export function useMyPublications(params: { skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.publications.myPublications(params),
    queryFn: () => publicationsApiV1.getMyPublications({ skip: params.skip, limit: params.limit }),
  });
}

export function usePublication(id: string) {
  return useQuery({
    queryKey: queryKeys.publications.detail(id),
    queryFn: () => publicationsApiV1.getPublication(id),
    enabled: !!id,
  });
}

export function useCreatePublication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreatePublicationDto) => publicationsApiV1.createPublication(data),
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
