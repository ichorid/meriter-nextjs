import { useTranslations } from 'next-intl';
import { PublicationCardComponent as PublicationCard } from '@/components/organisms/Publication';
import { EmptyState } from '@/components/organisms/EmptyState/EmptyState';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { Loader2 } from 'lucide-react';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useMarkFavoriteAsViewed } from '@/hooks/api/useFavorites';
import type { FeedItem, Wallet } from '@/types/api-v1';

interface ProfileFavoritesTabProps {
  favorites: Array<{
    favorite: {
      id: string;
      targetType: 'publication' | 'poll' | 'project';
      targetId: string;
      isUnread: boolean;
    };
    item: FeedItem;
  }>;
  isLoading: boolean;
  wallets: Wallet[];
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
}

export function ProfileFavoritesTab({
  favorites,
  isLoading,
  wallets,
  fetchNextPage,
  hasNextPage = false,
  isFetchingNextPage = false,
}: ProfileFavoritesTabProps) {
  const t = useTranslations('home');
  const markAsViewed = useMarkFavoriteAsViewed();

  const observerTarget = useInfiniteScroll({
    hasNextPage,
    fetchNextPage: fetchNextPage || (() => {}),
    isFetchingNextPage,
    threshold: 200,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <EmptyState
        title="No favorites yet"
        message={t('empty.publications.message')}
      />
    );
  }

  return (
    <div className="space-y-4 bg-base-100 dark:bg-base-100">
      {favorites.map((fav) => {
        const isUnread = fav.favorite.isUnread;
        return (
          <div
            key={fav.favorite.id}
            className={
              isUnread
                ? 'rounded-lg bg-warning/10 shadow-none p-2'
                : 'hover:shadow-md transition-all duration-200 rounded-lg'
            }
            onClick={() => {
              if (isUnread) {
                markAsViewed.mutate({
                  targetType: fav.favorite.targetType,
                  targetId: fav.favorite.targetId,
                });
              }
            }}
          >
            <PublicationCard
              publication={fav.item}
              wallets={wallets}
              showCommunityAvatar={true}
            />
          </div>
        );
      })}

      <div ref={observerTarget} className="h-4" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
        </div>
      )}
    </div>
  );
}


