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
            // initialPageParam: 1,
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
            // initialPageParam: 1,
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
            // initialPageParam: 1,
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
            // Cancel both finite and infinite queries
            await utils.publications.getAll.cancel();

            if (variables.communityId) {
                await queryClient.cancelQueries({
                    queryKey: queryKeys.publications.byCommunity(variables.communityId),
                });
            }

            // Snapshot the previous value
            const previousPublications = utils.publications.getAll.getData();

            // Optimistically update the cache with a temporary publication
            const optimisticId = `temp-${Date.now()}`;
            const optimisticPublication = {
                id: optimisticId,
                communityId: variables.communityId,
                authorId: user?.id || '',
                content: variables.content || variables.description || '',
                type: variables.type || 'text',
                title: variables.title || '',
                description: variables.description || '',
                postType: variables.postType || 'basic',
                isProject: variables.isProject || false,
                hashtags: variables.hashtags || [],
                // imageUrl: variables.imageUrl,
                images: variables.images || [],
                metrics: {
                    score: 0,
                    upvotes: 0,
                    downvotes: 0,
                    commentCount: 0,
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                userVote: null, // Ensure userVote is null
                author: { // Mock author for display
                    id: user?.id || '',
                    authId: user?.id || '',
                    authProvider: 'credentials',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    displayName: user?.name || 'me',
                    profile: { isVerified: false, photoUrl: user?.image },
                }
            } as any;

            // Helper to update feed data (both infinite and finite)
            const updateFeedData = (old: any) => {
                if (!old) return old;

                // Handle Infinite Query (pages)
                if (old.pages && Array.isArray(old.pages)) {
                    const newPages = [...old.pages];
                    if (newPages.length > 0) {
                        newPages[0] = {
                            ...newPages[0],
                            data: [optimisticPublication, ...(newPages[0].data || [])],
                        };
                    } else {
                        // Initialize first page if empty
                        newPages.push({ data: [optimisticPublication] });
                    }
                    return { ...old, pages: newPages };
                }

                // Handle Finite Query (data array)
                if (old.data && Array.isArray(old.data)) {
                    return {
                        ...old,
                        data: [optimisticPublication, ...old.data],
                    };
                }

                return old;
            };

            // 1. Update general finite queries
            utils.publications.getAll.setData(undefined, (old: any) => updateFeedData(old));

            // 2. Update community specific infinite/finite queries
            if (variables.communityId) {
                queryClient.setQueriesData(
                    {
                        queryKey: [['publications', 'getAll']],
                        predicate: (query) => {
                            const input = (query.queryKey[1] as any)?.input;
                            return input?.communityId === variables.communityId;
                        }
                    },
                    (old: any) => updateFeedData(old)
                );
            }

            return { previousPublications, optimisticId };
        },
        onError: (_err, variables, context) => {
            // Rollback optimistic update on error
            if (context?.previousPublications) {
                // We could try to restore exact previous state, but invalidating is safer on error
                // However, restoring the snapshot for the main query:
                utils.publications.getAll.setData(undefined, context.previousPublications);
            }
            // For infinite queries, we might just invalidate to be safe
            if (variables.communityId) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.publications.byCommunity(variables.communityId),
                });
            }
        },
        onSuccess: async (result, variables, context) => {
            // We do NOT invalidate feed queries here to prevent the new post from disappearing
            // if it doesn't belong on the first page according to current sort.
            // Instead, we update the cache to replace the optimistic post with the real one.

            const updateFeedWithRealData = (old: any) => {
                if (!old) return old;

                const replacePost = (list: any[]) => {
                    return list.map(item => item.id === context?.optimisticId ? result : item);
                };

                // Handle Infinite Query
                if (old.pages && Array.isArray(old.pages)) {
                    return {
                        ...old,
                        pages: old.pages.map((page: any, index: number) => {
                            // Only check first page for optimistic post usually, but map all to be safe
                            return {
                                ...page,
                                data: replacePost(page.data || [])
                            };
                        })
                    };
                }

                // Handle Finite Query
                if (old.data && Array.isArray(old.data)) {
                    return {
                        ...old,
                        data: replacePost(old.data)
                    };
                }

                return old;
            };

            // Update caches with real data
            utils.publications.getAll.setData(undefined, (old: any) => updateFeedWithRealData(old));

            if (variables.communityId) {
                queryClient.setQueriesData(
                    {
                        queryKey: [['publications', 'getAll']],
                        predicate: (query) => {
                            const input = (query.queryKey[1] as any)?.input;
                            return input?.communityId === variables.communityId;
                        }
                    },
                    (old: any) => updateFeedWithRealData(old)
                );
            }

            // Invalidate and refetch specific publication detail to ensure full data
            if (result?.id) {
                // Preset data to ensure immediate availability
                utils.publications.getById.setData({ id: result.id }, result);
                // Then invalidate to background refresh
                await utils.publications.getById.invalidate({ id: result.id });
                // We don't await refetch here to keep UI responsive
            }

            // Invalidate community details (counts etc)
            const communityId = (result as any)?.communityId || variables.communityId;
            if (communityId) {
                await utils.communities.getById.invalidate({ id: communityId });
            }

            // Invalidate quota queries (publication creation uses quota)
            if (user?.id && communityId) {
                await utils.wallets.getQuota.invalidate({ userId: user.id, communityId });
                await utils.wallets.getQuota.refetch({ userId: user.id, communityId });
            } else if (communityId) {
                queryClient.invalidateQueries({
                    queryKey: ['quota'],
                    predicate: (query) => {
                        const key = query.queryKey;
                        return key.length >= 3 && key[2] === communityId;
                    }
                });
            } else {
                queryClient.invalidateQueries({ queryKey: ['quota'], exact: false });
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
            // Optimistically update in lists
            queryClient.setQueriesData(
                { queryKey: [['publications', 'getAll']] },
                (old: any) => {
                    if (!old?.data) return old;
                    return {
                        ...old,
                        data: old.data.map((pub: any) =>
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
                utils.publications.getAll.setData(undefined, context.previousPublications);
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
            const communityId = (result as any)?.communityId || variables.communityId;
            if (communityId) {
                // Invalidate infinite queries for this community
                utils.publications.getAll.invalidate({ communityId });
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
            queryClient.invalidateQueries({ queryKey: queryKeys.publications.all });
            if (user?.id) {
                queryClient.invalidateQueries({ queryKey: [['wallets', 'getQuota'], { userId: user.id }] });
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
            queryClient.invalidateQueries({ queryKey: queryKeys.publications.all });
            if (user?.id) {
                queryClient.invalidateQueries({ queryKey: [['wallets', 'getQuota'], { userId: user.id }] });
            }
        },
    });
};

export const useRejectForward = () => {
    const queryClient = useQueryClient();

    return trpc.publications.rejectForward.useMutation({
        onSuccess: () => {
            // Invalidate publications queries to refresh the UI
            queryClient.invalidateQueries({ queryKey: queryKeys.publications.all });
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
