// Publications React Query hooks with tRPC
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc/client";
import {
    createGetNextPageParam,
    createArrayGetNextPageParam,
} from "@/lib/utils/pagination-utils";
import { STALE_TIME } from "@/lib/constants/query-config";
import { queryKeys } from "@/lib/constants/queryKeys";
import { useAuth } from "@/contexts/AuthContext";

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
    return trpc.publications.getAll.useQuery(
        {
            communityId: params.communityId,
            authorId: params.userId,
            hashtag: params.tag,
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
            staleTime: STALE_TIME.VERY_SHORT, // Always refetch when invalidated
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
            getNextPageParam: (lastPage, allPages) => {
                // Backend returns { data, total, skip, limit }
                // If we got a full page (data.length === pageSize), there might be more
                // Calculate current page from all pages fetched so far
                if (!lastPage || !lastPage.data) {
                    return undefined;
                }
                const currentPage = allPages.length;
                if (lastPage.data.length === pageSize) {
                    return currentPage + 1;
                }
                return undefined;
            },
            initialPageParam: 1,
            enabled: !!userId,
            staleTime: STALE_TIME.VERY_SHORT, // Always refetch when invalidated
        },
    );
}

export function usePublication(id: string) {
    return trpc.publications.getById.useQuery(
        { id },
        {
            enabled: !!id,
            staleTime: STALE_TIME.VERY_SHORT, // Always refetch when invalidated
        }
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
            getNextPageParam: (lastPage, allPages) => {
                // Backend returns { data, total, skip, limit }
                // If we got a full page (data.length === pageSize), there might be more
                // Calculate current page from all pages fetched so far
                if (!lastPage || !lastPage.data) {
                    return undefined;
                }
                const currentPage = allPages.length;
                if (lastPage.data.length === pageSize) {
                    return currentPage + 1;
                }
                return undefined;
            },
            initialPageParam: 1,
            enabled: !!communityId, // Ensure query only runs when communityId is available
            staleTime: STALE_TIME.VERY_SHORT, // Always refetch when invalidated
        },
    );
}

export function useInfiniteDeletedPublications(
    communityId: string,
    pageSize: number = 20,
    options?: {
        enabled?: boolean;
    }
) {
    return trpc.publications.getDeleted.useInfiniteQuery(
        {
            communityId,
            pageSize,
        },
        {
            getNextPageParam: (lastPage, allPages) => {
                // Backend returns { data, total, skip, limit }
                // If we got a full page (data.length === pageSize), there might be more
                // Calculate current page from all pages fetched so far
                if (!lastPage || !lastPage.data) {
                    return undefined;
                }
                const currentPage = allPages.length;
                if (lastPage.data.length === pageSize) {
                    return currentPage + 1;
                }
                return undefined;
            },
            initialPageParam: 1,
            enabled: !!communityId && (options?.enabled ?? true),
            staleTime: STALE_TIME.VERY_SHORT, // Always refetch when invalidated
            retry: false, // Don't retry on 403 errors
        },
    );
}

export const useCreatePublication = () => {
    const utils = trpc.useUtils();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return trpc.publications.create.useMutation({
        onMutate: async (variables) => {
            // Cancel any outgoing refetches to avoid overwriting optimistic update
            await utils.publications.getAll.cancel();

            // Snapshot the previous value
            const previousPublications = utils.publications.getAll.getData();

            // Optimistically update the cache with a temporary publication
            const optimisticPublication = {
                id: `temp-${Date.now()}`,
                communityId: variables.communityId,
                authorId: '', // Will be filled by server
                content: variables.content || variables.description || '',
                type: variables.type || 'text',
                title: variables.title || '',
                description: variables.description || '',
                postType: variables.postType || 'basic',
                isProject: variables.isProject || false,
                hashtags: variables.hashtags || [],
                imageUrl: variables.imageUrl,
                images: variables.images || [],
                metrics: {
                    score: 0,
                    upvotes: 0,
                    downvotes: 0,
                    commentCount: 0,
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            // Optimistically update lists
            utils.publications.getAll.setData(
                (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        data: [optimisticPublication, ...(old.data || [])],
                    };
                }
            );

            return { previousPublications };
        },
        onError: (_err, _variables, context) => {
            // Rollback optimistic update on error
            if (context?.previousPublications) {
                utils.publications.getAll.setData(context.previousPublications);
            }
        },
        onSuccess: async (result) => {
            // Invalidate and refetch publications lists to get real data
            await utils.publications.getAll.invalidate();
            await utils.publications.getAll.refetch();

            // Invalidate and refetch specific publication detail if we have the ID
            if (result?.id) {
                await utils.publications.getById.invalidate({ id: result.id });
                await utils.publications.getById.refetch({ id: result.id });
            }

            // Invalidate and refetch community feed if we have communityId
            if (result?.communityId) {
                // Invalidate community-specific queries
                await utils.communities.getById.invalidate({ id: result.communityId });
                await utils.communities.getById.refetch({ id: result.communityId });

                // Invalidate infinite queries for this community
                queryClient.invalidateQueries({
                    queryKey: queryKeys.publications.byCommunity(result.communityId),
                    exact: false,
                });
                queryClient.refetchQueries({
                    queryKey: queryKeys.publications.byCommunity(result.communityId),
                    exact: false,
                });
            }

            // Invalidate quota queries (publication creation uses quota)
            if (user?.id && result?.communityId) {
                await utils.wallets.getQuota.invalidate({ userId: user.id, communityId: result.communityId });
                await utils.wallets.getQuota.refetch({ userId: user.id, communityId: result.communityId });
            } else if (result?.communityId) {
                // Broad invalidation for all quota queries in this community
                queryClient.invalidateQueries({
                    queryKey: ['quota'],
                    predicate: (query) => {
                        const key = query.queryKey;
                        return key.length >= 3 && key[2] === result.communityId;
                    }
                });
                queryClient.refetchQueries({
                    queryKey: ['quota'],
                    predicate: (query) => {
                        const key = query.queryKey;
                        return key.length >= 3 && key[2] === result.communityId;
                    }
                });
            } else {
                // Broad invalidation for all quota queries
                queryClient.invalidateQueries({ queryKey: ['quota'], exact: false });
                queryClient.refetchQueries({ queryKey: ['quota'], exact: false });
            }
        },
    });
};

export const useUpdatePublication = () => {
    const utils = trpc.useUtils();
    const queryClient = useQueryClient();

    return trpc.publications.update.useMutation({
        onMutate: async (variables) => {
            // Cancel any outgoing refetches to avoid overwriting optimistic update
            await utils.publications.getAll.cancel();
            await utils.publications.getById.cancel({ id: variables.id });

            // Snapshot the previous values
            const previousPublicationDetail = utils.publications.getById.getData({ id: variables.id });
            const previousPublications = utils.publications.getAll.getData();

            // Optimistically update the publication in cache
            if (previousPublicationDetail) {
                utils.publications.getById.setData(
                    { id: variables.id },
                    {
                        ...previousPublicationDetail,
                        ...variables,
                        updatedAt: new Date().toISOString(),
                    }
                );
            }

            // Optimistically update in lists
            utils.publications.getAll.setData(
                (old) => {
                    if (!old?.data) return old;
                    return {
                        ...old,
                        data: old.data.map((pub) =>
                            pub.id === variables.id
                                ? { ...pub, ...variables, updatedAt: new Date().toISOString() }
                                : pub
                        ),
                    };
                }
            );

            return { previousPublicationDetail, previousPublications };
        },
        onError: (_err, variables, context) => {
            // Rollback optimistic update on error
            if (context?.previousPublicationDetail) {
                utils.publications.getById.setData({ id: variables.id }, context.previousPublicationDetail);
            }
            if (context?.previousPublications) {
                utils.publications.getAll.setData(context.previousPublications);
            }
        },
        onSuccess: async (result, variables) => {
            // Invalidate and refetch publications lists to get real data
            await utils.publications.getAll.invalidate();
            await utils.publications.getAll.refetch();

            // Invalidate and refetch specific publication
            await utils.publications.getById.invalidate({ id: variables.id });
            await utils.publications.getById.refetch({ id: variables.id });

            // Invalidate and refetch community feed if we have communityId
            const communityId = result?.communityId || variables.communityId;
            if (communityId) {
                // Invalidate infinite queries for this community
                queryClient.invalidateQueries({
                    queryKey: queryKeys.publications.byCommunity(communityId),
                    exact: false,
                });
                queryClient.refetchQueries({
                    queryKey: queryKeys.publications.byCommunity(communityId),
                    exact: false,
                });
            }
        },
    });
};

export const useProposeForward = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return trpc.publications.proposeForward.useMutation({
        onSuccess: () => {
            // Invalidate publications queries to refresh the UI
            queryClient.invalidateQueries({ queryKey: [queryKeys.PUBLICATIONS] });
            if (user?.id) {
                queryClient.invalidateQueries({ queryKey: [queryKeys.USER_QUOTA, user.id] });
            }
        },
    });
};

export const useForward = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return trpc.publications.forward.useMutation({
        onSuccess: () => {
            // Invalidate publications queries to refresh the UI
            queryClient.invalidateQueries({ queryKey: [queryKeys.PUBLICATIONS] });
            if (user?.id) {
                queryClient.invalidateQueries({ queryKey: [queryKeys.USER_QUOTA, user.id] });
            }
        },
    });
};

export const useRejectForward = () => {
    const queryClient = useQueryClient();

    return trpc.publications.rejectForward.useMutation({
        onSuccess: () => {
            // Invalidate publications queries to refresh the UI
            queryClient.invalidateQueries({ queryKey: [queryKeys.PUBLICATIONS] });
        },
    });
};

export const useDeletePublication = () => {
    const utils = trpc.useUtils();
    const queryClient = useQueryClient();

    return trpc.publications.delete.useMutation({
        onSuccess: async (_result, variables) => {
            // Invalidate and refetch publications lists
            await utils.publications.getAll.invalidate();
            await utils.publications.getAll.refetch();

            // Invalidate deleted publications query (so it appears in deleted tab for leads)
            // We need to get the communityId to invalidate the correct query
            // Since we don't have it in variables, we'll do a broad invalidation
            await utils.publications.getDeleted.invalidate();

            // Remove the deleted publication from cache (but keep it in deleted query)
            utils.publications.getById.setData({ id: variables.id }, undefined);

            // Invalidate infinite queries (publication might have been in a community feed)
            queryClient.invalidateQueries({
                queryKey: queryKeys.publications.all,
                exact: false,
            });
            queryClient.refetchQueries({
                queryKey: queryKeys.publications.all,
                exact: false,
            });
        },
    });
};

export const useRestorePublication = () => {
    const utils = trpc.useUtils();
    const queryClient = useQueryClient();
    
    return trpc.publications.restore.useMutation({
        onSuccess: async (_result, variables) => {
            // Invalidate and refetch publications lists
            await utils.publications.getAll.invalidate();
            await utils.publications.getAll.refetch();
            
            // Invalidate deleted publications query (so restored publication disappears from deleted list)
            await utils.publications.getDeleted.invalidate();
            
            // Invalidate the specific publication to refetch it (now it should be visible)
            await utils.publications.getById.invalidate({ id: variables.id });
            await utils.publications.getById.refetch({ id: variables.id });
            
            // Invalidate infinite queries (publication should appear in community feed)
            queryClient.invalidateQueries({
                queryKey: queryKeys.publications.all,
                exact: false,
            });
            queryClient.refetchQueries({
                queryKey: queryKeys.publications.all,
                exact: false,
            });
        },
    });
};

export const usePermanentDeletePublication = () => {
    const utils = trpc.useUtils();
    const queryClient = useQueryClient();
    
    return trpc.publications.permanentDelete.useMutation({
        onSuccess: async (_result, variables) => {
            // Invalidate and refetch publications lists
            await utils.publications.getAll.invalidate();
            await utils.publications.getAll.refetch();
            
            // Invalidate deleted publications query (so permanently deleted publication disappears from deleted list)
            await utils.publications.getDeleted.invalidate();
            
            // Remove the permanently deleted publication from cache completely
            utils.publications.getById.setData({ id: variables.id }, undefined);
            
            // Invalidate infinite queries (publication should disappear from all feeds)
            queryClient.invalidateQueries({
                queryKey: queryKeys.publications.all,
                exact: false,
            });
            queryClient.refetchQueries({
                queryKey: queryKeys.publications.all,
                exact: false,
            });
        },
    });
};
