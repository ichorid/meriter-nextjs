// Publications React Query hooks with tRPC
import { trpc } from "@/lib/trpc/client";
import type {
    Publication,
    PaginatedResponse,
    CreatePublicationDto,
    UpdatePublicationDto,
} from "@/types/api-v1";
import {
    createGetNextPageParam,
    createArrayGetNextPageParam,
} from "@/lib/utils/pagination-utils";

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
    return trpc.publications.getAll.useQuery({
        communityId: params.communityId,
        authorId: params.userId,
        hashtag: params.tag,
        page: params.skip !== undefined ? Math.floor((params.skip || 0) / (params.limit || 20)) + 1 : undefined,
        pageSize: params.limit,
        limit: params.limit,
        skip: params.skip,
    });
}

export function useMyPublications(
    params: { skip?: number; limit?: number; userId?: string } = {}
) {
    return useQuery({
        queryKey: queryKeys.publications.myPublications(params),
        queryFn: async () => {
            // If userId is provided, use the publications endpoint with authorId query param
            if (params.userId) {
                return publicationsApiV1.getPublications({
                    skip: params.skip,
                    limit: params.limit,
                    userId: params.userId,
                });
            } else {
                // Try to use /api/v1/users/me/publications endpoint (may not exist)
                // Fallback: return empty array if no userId provided
                try {
                    return await publicationsApiV1.getMyPublications({
                        skip: params.skip,
                        limit: params.limit,
                    });
                } catch (error) {
                    console.warn(
                        "getMyPublications failed, returning empty array:",
                        error
                    );
                    return [];
                }
            }
        },
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
            return publicationsApiV1.getPublications({
                skip,
                limit: pageSize,
                userId,
            });
        },
        getNextPageParam: createArrayGetNextPageParam<Publication>(pageSize),
        initialPageParam: 1,
        enabled: !!userId,
    });
}

export function usePublication(id: string) {
    return trpc.publications.getById.useQuery(
        { id },
        { enabled: !!id }
    );
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
            return communitiesApiV1.getCommunityPublications(communityId, {
                page: pageParam,
                pageSize,
                sort,
                order,
            });
        },
        getNextPageParam: createGetNextPageParam<Publication>(),
        initialPageParam: 1,
        enabled: !!communityId, // Ensure query only runs when communityId is available
    });
}

export const useCreatePublication = () => {
    const utils = trpc.useUtils();
    
    return trpc.publications.create.useMutation({
        onSuccess: (result, variables) => {
            // Invalidate publications lists and community feed
            utils.publications.getAll.invalidate();
            // Invalidate quota queries for the community
            // Note: tRPC doesn't have quota router yet, so we'll need to invalidate manually if needed
        },
    });
};

export const useUpdatePublication = () => {
    const utils = trpc.useUtils();
    
    return trpc.publications.update.useMutation({
        onSuccess: (result, variables) => {
            // Invalidate publications lists and specific publication
            utils.publications.getAll.invalidate();
            utils.publications.getById.invalidate({ id: variables.id });
        },
    });
};

export const useDeletePublication = () => {
    const utils = trpc.useUtils();
    
    return trpc.publications.delete.useMutation({
        onSuccess: (result, variables) => {
            // Invalidate publications lists
            utils.publications.getAll.invalidate();
            // Remove the deleted publication from cache
            utils.publications.getById.setData({ id: variables.id }, undefined);
        },
    });
};
