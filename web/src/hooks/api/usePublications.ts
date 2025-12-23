// Publications React Query hooks with tRPC
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
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
import { queryKeys } from "@/lib/constants/queryKeys";

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
    return trpc.publications.getAll.useQuery(
        {
            authorId: params.userId,
            skip: params.skip,
            limit: params.limit,
        },
        {
            enabled: !!params.userId, // Only enable if userId is provided
        },
    );
}

export function useInfiniteMyPublications(
    userId: string,
    pageSize: number = 20
) {
    return trpc.publications.getAll.useInfiniteQuery(
        {
            authorId: userId,
            pageSize,
        },
        {
            getNextPageParam: (lastPage) => {
                if (lastPage.pagination.hasNext) {
                    return lastPage.pagination.page + 1;
                }
                return undefined;
            },
            initialPageParam: 1,
            enabled: !!userId,
        },
    );
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
    const { pageSize = 5, sort = "score" } = params;

    return trpc.publications.getAll.useInfiniteQuery(
        {
            communityId,
            pageSize,
        },
        {
            getNextPageParam: (lastPage) => {
                if (lastPage.pagination.hasNext) {
                    return lastPage.pagination.page + 1;
                }
                return undefined;
            },
            initialPageParam: 1,
            enabled: !!communityId, // Ensure query only runs when communityId is available
        },
    );
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
