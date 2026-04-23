// Comments React Query hooks with tRPC
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc/client";
import { queryKeys } from "@/lib/constants/queryKeys";
import { STALE_TIME } from "@/lib/constants/query-config";
import { refetchCommunityFeed } from "@/hooks/api/invalidate-community-session-caches";

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
        return trpc.comments.getByPublicationId.useQuery(
            {
                publicationId: params.publicationId,
                page: params.skip !== undefined ? Math.floor((params.skip || 0) / (params.limit || 20)) + 1 : undefined,
                pageSize: params.limit,
                limit: params.limit,
                skip: params.skip,
            },
            {
                staleTime: STALE_TIME.VERY_SHORT, // Always refetch when invalidated
            }
        );
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
        { 
            enabled: !!publicationId,
            staleTime: STALE_TIME.VERY_SHORT, // Always refetch when invalidated
        }
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
        { 
            enabled: !!commentId,
            staleTime: STALE_TIME.VERY_SHORT, // Always refetch when invalidated
        }
    );
}

// Get single comment
export function useComment(id: string) {
    return trpc.comments.getById.useQuery(
        { id },
        { 
            enabled: !!id,
            staleTime: STALE_TIME.VERY_SHORT, // Always refetch when invalidated
        }
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
    const queryClient = useQueryClient();
    
    return trpc.comments.create.useMutation({
        onMutate: async (variables) => {
            const publicationIdForCache =
                variables.targetType === 'publication'
                    ? variables.targetId
                    : 'publicationId' in variables
                      ? (variables as { publicationId?: string }).publicationId
                      : undefined;

            // Cancel any outgoing refetches to avoid overwriting optimistic update
            if (publicationIdForCache) {
                await utils.comments.getByPublicationId.cancel({ publicationId: publicationIdForCache });
            } else {
                await utils.comments.getByPublicationId.cancel();
            }
            
            // Snapshot the previous values
            const previousComments = publicationIdForCache
                ? utils.comments.getByPublicationId.getData({ publicationId: publicationIdForCache })
                : utils.comments.getByPublicationId.getData();
            
            // Optimistically update the cache with a temporary comment
            const optimisticComment = {
                id: `temp-${Date.now()}`,
                targetType: variables.targetType,
                targetId: variables.targetId,
                parentCommentId: variables.parentCommentId,
                authorId: '',
                content: variables.content || '',
                metrics: {
                    score: 0,
                    upvotes: 0,
                    downvotes: 0,
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            
            // Optimistically update lists
            if (publicationIdForCache) {
                utils.comments.getByPublicationId.setData(
                    { publicationId: publicationIdForCache },
                    (old: any) => {
                        if (!old) return old;
                        return {
                            ...old,
                            data: [optimisticComment, ...(old.data || [])],
                        };
                    }
                );
            }
            
            return { previousComments, publicationIdForCache };
        },
        onError: (_err, variables, context) => {
            const publicationIdForCache =
                variables.targetType === 'publication'
                    ? variables.targetId
                    : 'publicationId' in variables
                      ? (variables as { publicationId?: string }).publicationId
                      : undefined;
            // Rollback optimistic update on error
            if (context?.previousComments && publicationIdForCache) {
                utils.comments.getByPublicationId.setData(
                    { publicationId: publicationIdForCache },
                    context.previousComments
                );
            }
        },
        onSuccess: async (result, variables) => {
            const publicationIdForCache =
                variables.targetType === 'publication'
                    ? variables.targetId
                    : 'publicationId' in variables
                      ? (variables as { publicationId?: string }).publicationId
                      : undefined;

            // Invalidate and refetch comments lists to get real data
            if (publicationIdForCache) {
                await utils.comments.getByPublicationId.invalidate({ publicationId: publicationIdForCache });
                await utils.comments.getByPublicationId.refetch({ publicationId: publicationIdForCache });
            } else {
                await utils.comments.getByPublicationId.invalidate();
                await utils.comments.getByPublicationId.refetch();
            }
            
            await utils.comments.getReplies.invalidate();
            await utils.comments.getReplies.refetch();
            
            // Set the new comment in cache
            utils.comments.getById.setData({ id: result.id }, result);
            
            // Invalidate publication detail queries (comments count changes)
            if (publicationIdForCache) {
                await utils.publications.getById.invalidate({ id: publicationIdForCache });
                await utils.publications.getById.refetch({ id: publicationIdForCache });
                const pub = utils.publications.getById.getData({ id: publicationIdForCache }) as
                    | { communityId?: string }
                    | undefined;
                if (pub?.communityId) {
                    await refetchCommunityFeed(utils, pub.communityId);
                }
            }
        },
    });
};

// Update comment
export const useUpdateComment = () => {
    const utils = trpc.useUtils();
    const queryClient = useQueryClient();
    
    return trpc.comments.update.useMutation({
        onMutate: async (variables) => {
            // Cancel any outgoing refetches to avoid overwriting optimistic update
            await utils.comments.getByPublicationId.cancel();
            await utils.comments.getById.cancel({ id: variables.id });
            
            // Snapshot the previous values
            const previousCommentDetail = utils.comments.getById.getData({ id: variables.id });
            const previousComments = utils.comments.getByPublicationId.getData();
            
            // Optimistically update the comment in cache
            if (previousCommentDetail) {
                utils.comments.getById.setData(
                    { id: variables.id },
                    {
                        ...previousCommentDetail,
                        ...variables,
                        updatedAt: new Date().toISOString(),
                    }
                );
            }
            
            // Optimistically update in lists
            utils.comments.getByPublicationId.setData(
                (old: any) => {
                    if (!old?.data) return old;
                    return {
                        ...old,
                        data: old.data.map((comment: any) =>
                            comment.id === variables.id
                                ? { ...comment, ...variables, updatedAt: new Date().toISOString() }
                                : comment
                        ),
                    };
                }
            );
            
            return { previousCommentDetail, previousComments };
        },
        onError: (_err, variables, context) => {
            // Rollback optimistic update on error
            if (context?.previousCommentDetail) {
                utils.comments.getById.setData({ id: variables.id }, context.previousCommentDetail);
            }
            if (context?.previousComments) {
                utils.comments.getByPublicationId.setData(context.previousComments);
            }
        },
        onSuccess: async (result, variables) => {
            const existing = utils.comments.getById.getData({ id: variables.id }) as
                | { publicationId?: string }
                | undefined;
            const publicationIdForFeed = existing?.publicationId;

            // Invalidate and refetch comments lists to get real data
            await utils.comments.getByPublicationId.invalidate();
            await utils.comments.getByPublicationId.refetch();
            
            await utils.comments.getReplies.invalidate();
            await utils.comments.getReplies.refetch();
            
            // Update cache
            utils.comments.getById.setData({ id: variables.id }, result);
            
            // Invalidate and refetch comment details
            await utils.comments.getDetails.invalidate({ id: variables.id });
            await utils.comments.getDetails.refetch({ id: variables.id });

            if (publicationIdForFeed) {
                const pub = utils.publications.getById.getData({ id: publicationIdForFeed }) as
                    | { communityId?: string }
                    | undefined;
                if (pub?.communityId) {
                    await refetchCommunityFeed(utils, pub.communityId);
                }
            }
        },
    });
};

// Delete comment
export const useDeleteComment = () => {
    const utils = trpc.useUtils();
    const queryClient = useQueryClient();
    
    return trpc.comments.delete.useMutation({
        onSuccess: async (result, variables) => {
            const existing = utils.comments.getById.getData({ id: variables.id }) as
                | { publicationId?: string }
                | undefined;
            const publicationIdForFeed = existing?.publicationId;

            // Invalidate and refetch comments lists
            await utils.comments.getByPublicationId.invalidate();
            await utils.comments.getByPublicationId.refetch();
            
            await utils.comments.getReplies.invalidate();
            await utils.comments.getReplies.refetch();
            
            // Remove from cache
            utils.comments.getById.setData({ id: variables.id }, undefined);
            
            // Invalidate and refetch comment details
            await utils.comments.getDetails.invalidate({ id: variables.id });
            await utils.comments.getDetails.refetch({ id: variables.id });
            
            // Invalidate publication detail queries (comments count changes)
            // Broadly invalidate publication details; without publicationId, invalidate all getById queries
            await utils.publications.getById.invalidate();
            await utils.publications.getById.refetch();

            if (publicationIdForFeed) {
                const pub = utils.publications.getById.getData({ id: publicationIdForFeed }) as
                    | { communityId?: string }
                    | undefined;
                if (pub?.communityId) {
                    await refetchCommunityFeed(utils, pub.communityId);
                }
            }
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
