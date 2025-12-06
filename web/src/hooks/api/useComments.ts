// Comments React Query hooks
import {
    useQuery,
    useInfiniteQuery,
} from "@tanstack/react-query";
import { commentsApiV1, usersApiV1 } from "@/lib/api/v1";
import { queryKeys } from "@/lib/constants/queryKeys";
import { STALE_TIME } from "@/lib/constants/query-config";
import { serializeQueryParams } from "@/lib/utils/queryKeys";
import { useValidatedQuery } from "@/lib/api/validated-query";
import { createMutation } from "@/lib/api/mutation-factory";
import { CommentSchema, CreateCommentDtoSchema } from "@/types/api-v1/schemas";
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
    return useQuery({
        queryKey: commentsKeys.list(params),
        queryFn: () => commentsApiV1.getComments(params),
        staleTime: STALE_TIME.MEDIUM,
    });
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
    // Convert page/pageSize to skip/limit for API consistency
    const queryParams = createPaginationParams(params);

    return useQuery({
        queryKey: [
            ...commentsKeys.byPublication(publicationId),
            serializeQueryParams(params),
        ],
        queryFn: () =>
            commentsApiV1.getPublicationComments(publicationId, queryParams),
        staleTime: STALE_TIME.MEDIUM,
        enabled: !!publicationId,
    });
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
    // Convert page/pageSize to skip/limit for API consistency
    const queryParams = createPaginationParams(params);

    return useQuery({
        queryKey: [
            ...commentsKeys.byComment(commentId),
            serializeQueryParams(params),
        ],
        queryFn: () => commentsApiV1.getCommentReplies(commentId, queryParams),
        staleTime: STALE_TIME.MEDIUM,
        enabled: !!commentId,
    });
}

// Get single comment
export function useComment(id: string) {
    return useValidatedQuery({
        queryKey: commentsKeys.detail(id),
        queryFn: () => commentsApiV1.getComment(id),
        schema: CommentSchema,
        context: `useComment(${id})`,
        staleTime: STALE_TIME.LONG,
        enabled: !!id,
    });
}

// Get comment details (with all metadata for popup)
export function useCommentDetails(id: string) {
    return useQuery({
        queryKey: commentsKeys.detailData(id),
        queryFn: () => commentsApiV1.getCommentDetails(id),
        staleTime: STALE_TIME.LONG,
        enabled: !!id,
    });
}

// Create comment
export const useCreateComment = createMutation<Comment, CreateCommentDto>({
    mutationFn: (data) => commentsApiV1.createComment(data),
    inputSchema: CreateCommentDtoSchema,
    outputSchema: CommentSchema,
    validationContext: "useCreateComment",
    errorContext: "Create comment error",
    invalidations: {
        comments: {
            lists: true,
            exact: false,
        },
    },
    setQueryData: {
        queryKey: (result) => commentsKeys.detail(result.id),
        data: (result) => result,
    },
});

// Update comment
export const useUpdateComment = createMutation<
    Comment,
    { id: string; data: Partial<CreateCommentDto> }
>({
    mutationFn: ({ id, data }) => commentsApiV1.updateComment(id, data),
    errorContext: "Update comment error",
    invalidations: {
        comments: {
            lists: true,
            detail: (result) => result.id,
            byPublication: (result) =>
                result.targetType === "publication" ? result.targetId : undefined,
            byComment: (result) =>
                result.targetType === "comment" ? result.targetId : undefined,
        },
    },
    setQueryData: {
        queryKey: (result) => commentsKeys.detail(result.id),
        data: (result) => result,
    },
});

// Delete comment
export const useDeleteComment = createMutation<void, string>({
    mutationFn: (id) => commentsApiV1.deleteComment(id),
    errorContext: "Delete comment error",
    invalidations: {
        comments: {
            lists: true,
        },
    },
    removeQuery: {
        queryKey: (deletedId) => commentsKeys.detail(deletedId),
    },
});

// Get user's comments
export function useMyComments(
    userId: string,
    params: { skip?: number; limit?: number } = {}
) {
    return useQuery({
        queryKey: queryKeys.comments.myComments(userId, params),
        queryFn: () => usersApiV1.getUserComments(userId, params),
        staleTime: STALE_TIME.MEDIUM,
        enabled: !!userId,
    });
}

// Infinite query for user's comments
export function useInfiniteMyComments(userId: string, pageSize: number = 20) {
    return useInfiniteQuery({
        queryKey: [...queryKeys.comments.my(userId), "infinite", pageSize],
        queryFn: ({ pageParam = 1 }: { pageParam: number }) => {
            const skip = (pageParam - 1) * pageSize;
            return usersApiV1.getUserComments(userId, {
                skip,
                limit: pageSize,
            });
        },
        getNextPageParam: createGetNextPageParam<Comment>(),
        initialPageParam: 1,
        enabled: !!userId,
    });
}
