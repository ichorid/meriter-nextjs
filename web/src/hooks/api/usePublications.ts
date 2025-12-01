// Publications React Query hooks with Zod validation
import {
    useQuery,
    useMutation,
    useQueryClient,
    useInfiniteQuery,
} from "@tanstack/react-query";
import { publicationsApi } from "@/lib/api/wrappers/publications-api";
import { queryKeys } from "@/lib/constants/queryKeys";
import {
    useValidatedQuery,
    useValidatedMutation,
} from "@/lib/api/validated-query";
import { PublicationSchema, CreatePublicationDtoSchema } from "@/types/api-v1/schemas";
import type {
    Publication,
    PaginatedResponse,
    CreatePublicationDto,
} from "@/types/api-v1";

// Import generated hooks wrappers
import {
  usePublicationsGenerated,
  usePublicationGenerated,
  useMyPublicationsGenerated,
  useInfiniteMyPublicationsGenerated,
  useCreatePublicationGenerated,
  useDeletePublicationGenerated,
} from './usePublications.generated-wrapper';

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
        queryFn: () => publicationsApi.getList(params),
    });
}

export function useMyPublications(
    params: { skip?: number; limit?: number; userId?: string } = {}
) {
    return useQuery({
        queryKey: queryKeys.publications.myPublications(params),
        queryFn: () => publicationsApi.getMy(params),
        enabled: !!params.userId, // Only enable if userId is provided
    });
}

export function useInfiniteMyPublications(
    userId: string,
    pageSize: number = 20
) {
    return useInfiniteQuery({
        queryKey: [
            ...queryKeys.publications.my(),
            "infinite",
            userId,
            pageSize,
        ],
        queryFn: ({ pageParam = 1 }: { pageParam: number }) => {
            const skip = (pageParam - 1) * pageSize;
            return publicationsApi.getList({
                skip,
                limit: pageSize,
                userId,
            });
        },
        getNextPageParam: (lastPage: Publication[]) => {
            // If we got less than pageSize, we're done
            if (lastPage.length < pageSize) {
                return undefined;
            }
            // Otherwise, return next page number
            const currentPage =
                Math.floor((lastPage.length || 0) / pageSize) + 1;
            return currentPage + 1;
        },
        initialPageParam: 1,
        enabled: !!userId,
    });
}

export function usePublication(id: string) {
    return useValidatedQuery({
        queryKey: queryKeys.publications.detail(id),
        queryFn: () => publicationsApi.getById(id),
        schema: PublicationSchema,
        context: `usePublication(${id})`,
        enabled: !!id,
    });
}

export function useInfinitePublicationsByCommunity(
    communityId: string,
    params: { pageSize?: number; sort?: string; order?: string } = {}
) {
    const { pageSize = 5, sort = "score", order = "desc" } = params;

    return useInfiniteQuery({
        queryKey: queryKeys.publications.byCommunityInfinite(
            communityId,
            params
        ),
        queryFn: ({ pageParam }: { pageParam: number }) => {
            return publicationsApi.getByCommunity(communityId, {
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
        mutationFn: (data: CreatePublicationDto) =>
            publicationsApi.create(data),
        inputSchema: CreatePublicationDtoSchema,
        outputSchema: PublicationSchema,
        context: "useCreatePublication",
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.publications.lists(),
            });
        },
    });
}

export function useDeletePublication() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => publicationsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.publications.lists(),
            });
        },
    });
}
