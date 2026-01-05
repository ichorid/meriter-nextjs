'use client';

import React, { useCallback } from 'react';
import { Star } from 'lucide-react';
import type { FavoriteTargetType } from '@/hooks/api/useFavorites';
import {
  useAddFavorite,
  useIsFavorite,
  useRemoveFavorite,
} from '@/hooks/api/useFavorites';
import { useAuth } from '@/contexts/AuthContext';

export interface FavoriteStarProps {
  targetType: FavoriteTargetType;
  targetId: string;
  className?: string;
}

export function FavoriteStar({ targetType, targetId, className = '' }: FavoriteStarProps) {
  const { isAuthenticated } = useAuth();
  const { data } = useIsFavorite(targetType, targetId);
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const isFav = data?.isFavorite === true;
  const isBusy = addFavorite.isPending || removeFavorite.isPending;

  const onToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isAuthenticated || !targetId || isBusy) return;

      if (isFav) {
        await removeFavorite.mutateAsync({ targetType, targetId });
      } else {
        await addFavorite.mutateAsync({ targetType, targetId });
      }
    },
    [
      addFavorite,
      isAuthenticated,
      isBusy,
      isFav,
      removeFavorite,
      targetId,
      targetType,
    ],
  );

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!isAuthenticated || isBusy}
      className={`p-1 rounded-full hover:bg-base-200 transition-colors ${className}`}
      aria-label={isFav ? 'Unfavorite' : 'Favorite'}
    >
      <Star
        className={`w-5 h-5 ${
          isFav ? 'text-yellow-500 fill-yellow-500' : 'text-base-content/40'
        }`}
      />
    </button>
  );
}


