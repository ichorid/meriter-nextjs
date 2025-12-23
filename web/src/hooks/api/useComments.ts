// Comments React Query hooks with tRPC
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc/client";
import { queryKeys } from "@/lib/constants/queryKeys";
import { STALE_TIME } from "@/lib/constants/query-config";
import type {
    Comment,
    CreateCommentDto,
    PaginatedResponse,
} from "@/types/api-v1";
import { createGetNextPageParam, createPaginationParams } from "@/lib/utils/pagination-utils";

interface GetCommentsRequest {
    skip?: number;
    limit?: number;
    publicationId?: string;
    userId?: string;
}

// Re-export commentsKeys for backwards compatibility during migration
// TODO: Remove this export once all references are updated to use queryKeys.comments
export const commentsKeys = queryKeys.comments;

// Get comments with pagination
export function useComments(params: GetCommentsRequest = {}) {
    // Note: tRPC comments.getAll doesn't exist yet, using getByPublicationId if publicationId provided
    if (params.publicationId) {
        return trpc.comments.getByPublicationId.useQuery({
            publicationId: params.publicationId,
            page: params.skip !== undefined ? Math.floor((params.skip || 0) / (params.limit || 20)) + 1 : undefined,
            pageSize: params.limit,
            limit: params.limit,
            skip: params.skip,
        });
    }
    // Fallback for other cases - return empty for now
    return trpc.comments.getByPublicationId.useQuery(
        { publicationId: '' },
        { enabled: false }
    );
}

// Get comments by publication
export function useCommentsByPublication(
    publicationId: string,
    params: {
        page?: number;
        pageSize?: number;
        sort?: string;
        order?: string;
    } = {}
) {
    return trpc.comments.getByPublicationId.useQuery(
        {
            publicationId,
            page: params.page,
            pageSize: params.pageSize,
            sort: params.sort,
            order: params.order,
        },
        { enabled: !!publicationId }
    );
}

// Get comments by comment (replies)
export function useCommentsByComment(
    commentId: string,
    params: {
        page?: number;
        pageSize?: number;
        sort?: string;
        order?: string;
    } = {}
) {
    return trpc.comments.getReplies.useQuery(
        {
            id: commentId,
            page: params.page,
            pageSize: params.pageSize,
            sort: params.sort,
            order: params.order,
        },
        { enabled: !!commentId }
    );
}

// Get single comment
export function useComment(id: string) {
    return trpc.comments.getById.useQuery(
        { id },
        { enabled: !!id }
    );
}

// Get comment details (with all metadata for popup)
export function useCommentDetails(id: string) {
    return trpc.comments.getDetails.useQuery(
        { id },
        {
            queryKey: commentsKeys.detailData(id),
            staleTime: STALE_TIME.LONG,
            enabled: !!id,
        }
    );
}

// Create comment
export const useCreateComment = () => {
    const utils = trpc.useUtils();
    
    return trpc.comments.create.useMutation({
        onSuccess: (result, variables) => {
            // Invalidate comments lists
            utils.comments.getByPublicationId.invalidate();
            utils.comments.getReplies.invalidate();
            // Set the new comment in cache
            utils.comments.getById.setData({ id: result.id }, result);
        },
    });
};

// Update comment
export const useUpdateComment = () => {
    const utils = trpc.useUtils();
    
    return trpc.comments.update.useMutation({
        onSuccess: (result, variables) => {
            // Invalidate comments lists and update cache
            utils.comments.getByPublicationId.invalidate();
            utils.comments.getReplies.invalidate();
            utils.comments.getById.setData({ id: variables.id }, result);
        },
    });
};

// Delete comment
export const useDeleteComment = () => {
    const utils = trpc.useUtils();
    
    return trpc.comments.delete.useMutation({
        onSuccess: (result, variables) => {
            // Invalidate comments lists
            utils.comments.getByPublicationId.invalidate();
            utils.comments.getReplies.invalidate();
            // Remove from cache
            utils.comments.getById.setData({ id: variables.id }, undefined);
        },
    });
};

// Get user's comments
export function useMyComments(
    userId: string,
    params: { skip?: number; limit?: number } = {}
) {
    return trpc.comments.getByUserId.useQuery(
        {
            userId,
            skip: params.skip,
            limit: params.limit,
        },
        {
            queryKey: queryKeys.comments.myComments(userId, params),
            staleTime: STALE_TIME.MEDIUM,
            enabled: !!userId,
        }
    );
}

// Infinite query for user's comments
export function useInfiniteMyComments(userId: string, pageSize: number = 20) {
    return trpc.comments.getByUserId.useInfiniteQuery(
        {
            userId,
            pageSize,
        },
        {
            queryKey: [...queryKeys.comments.my(userId), "infinite", pageSize],
            getNextPageParam: (lastPage) => {
                if (lastPage.pagination.hasMore) {
                    return lastPage.pagination.page + 1;
                }
                return undefined;
            },
            initialPageParam: 1,
            enabled: !!userId,
        }
    );
}
