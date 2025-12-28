import { trpc } from '@/lib/trpc/client';
import { STALE_TIME } from '@/lib/constants/query-config';
import { useToastStore } from '@/shared/stores/toast.store';

export type FavoriteTargetType = 'publication' | 'poll' | 'project';

export interface FavoriteListItem<TItem> {
  favorite: {
    id: string;
    targetType: FavoriteTargetType;
    targetId: string;
    lastViewedAt: string | null;
    lastActivityAt: string | null;
    isUnread: boolean;
  };
  item: TItem;
}

export function useAddFavorite() {
  const utils = trpc.useUtils();
  return trpc.favorites.add.useMutation({
    onMutate: async (variables) => {
      const { targetType, targetId } = variables;
      
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await utils.favorites.isFavorite.cancel({ targetType, targetId });
      
      // Snapshot the previous value
      const previousIsFavorite = utils.favorites.isFavorite.getData({ targetType, targetId });
      
      // Optimistically update to true
      utils.favorites.isFavorite.setData(
        { targetType, targetId },
        { isFavorite: true }
      );
      
      return { previousIsFavorite, targetType, targetId };
    },
    onError: async (_err, _variables, context) => {
      // Rollback optimistic update on error
      if (context?.targetType && context.targetId) {
        if (context.previousIsFavorite !== undefined) {
          // Restore previous value
          utils.favorites.isFavorite.setData(
            { targetType: context.targetType, targetId: context.targetId },
            context.previousIsFavorite
          );
        } else {
          // If there was no previous data, invalidate to clear optimistic update
          await utils.favorites.isFavorite.invalidate({ 
            targetType: context.targetType, 
            targetId: context.targetId 
          });
        }
      }
    },
    onSuccess: async (_result, variables) => {
      const { targetType, targetId } = variables;
      
      // Invalidate queries to ensure consistency
      await Promise.all([
        utils.favorites.isFavorite.invalidate({ targetType, targetId }),
        utils.favorites.getUnreadCount.invalidate(),
        utils.favorites.getCount.invalidate(),
        utils.favorites.getAll.invalidate(),
      ]);
      
      // Show toast notification
      useToastStore.getState().addToast('Added to favorites', 'success');
    },
  });
}

export function useRemoveFavorite() {
  const utils = trpc.useUtils();
  return trpc.favorites.remove.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.favorites.getUnreadCount.invalidate(),
        utils.favorites.getCount.invalidate(),
        utils.favorites.getAll.invalidate(),
      ]);
    },
  });
}

export function useIsFavorite(targetType: FavoriteTargetType, targetId: string) {
  return trpc.favorites.isFavorite.useQuery(
    { targetType, targetId },
    {
      enabled: !!targetId,
      staleTime: STALE_TIME.VERY_SHORT,
    },
  );
}

export function useFavoriteCount() {
  return trpc.favorites.getCount.useQuery(undefined, {
    staleTime: STALE_TIME.VERY_SHORT,
  });
}

export function useUnreadFavoritesCount() {
  return trpc.favorites.getUnreadCount.useQuery(undefined, {
    staleTime: STALE_TIME.VERY_SHORT,
    refetchInterval: 30_000,
  });
}

export function useMarkFavoriteAsViewed() {
  const utils = trpc.useUtils();
  return trpc.favorites.markAsViewed.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.favorites.getUnreadCount.invalidate(),
        utils.favorites.getAll.invalidate(),
      ]);
    },
  });
}

export function useInfiniteFavorites(pageSize: number = 20) {
  return trpc.favorites.getAll.useInfiniteQuery(
    { pageSize },
    {
      getNextPageParam: (lastPage, allPages) => {
        if (!lastPage?.data) return undefined;
        if (lastPage.data.length === pageSize) {
          return allPages.length + 1;
        }
        return undefined;
      },
      initialPageParam: 1,
      staleTime: STALE_TIME.VERY_SHORT,
    },
  );
}


