import { trpc } from '@/lib/trpc/client';
import { STALE_TIME } from '@/lib/constants/query-config';

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
    onSuccess: async () => {
      await Promise.all([
        utils.favorites.getUnreadCount.invalidate(),
        utils.favorites.getCount.invalidate(),
        utils.favorites.getAll.invalidate(),
      ]);
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


