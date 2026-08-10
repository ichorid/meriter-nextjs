import { Injectable, Inject } from '@nestjs/common';
import { uid } from 'uid';
import {
  Favorite,
  FavoriteTargetType,
} from '../models/favorite/favorite.schema';
import { PaginationHelper, PaginationResult } from '../../common/helpers/pagination.helper';
import {
  FAVORITE_PERSISTENCE_PORT,
  type FavoritePersistencePort,
} from '../ports/favorite.persistence.port';

export interface GetFavoritesOptions {
  page?: number;
  pageSize?: number;
}

@Injectable()
export class FavoriteService {
  constructor(
    @Inject(FAVORITE_PERSISTENCE_PORT)
    private readonly favoritePersistence: FavoritePersistencePort,
  ) {}

  async addFavorite(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<Favorite> {
    const now = new Date();

    // Upsert to keep operation idempotent
    await this.favoritePersistence.upsertFavorite(
      userId,
      targetType,
      targetId,
      uid(),
      now,
    );

    const doc = await this.favoritePersistence.findByUserTarget(
      userId,
      targetType,
      targetId,
    );
    if (!doc) {
      // Extremely unlikely after upsert
      throw new Error('Failed to add favorite');
    }
    return doc as unknown as Favorite;
  }

  async removeFavorite(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<void> {
    await this.favoritePersistence.deleteFavorite(userId, targetType, targetId);
  }

  async isFavorite(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<boolean> {
    return this.favoritePersistence.exists(userId, targetType, targetId);
  }

  async getFavoriteCount(userId: string): Promise<number> {
    return this.favoritePersistence.countByUserId(userId);
  }

  async markAsViewed(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<void> {
    const now = new Date();
    await this.favoritePersistence.markAsViewed(
      userId,
      targetType,
      targetId,
      now,
    );
  }

  async touchFavoritesForTarget(
    targetType: FavoriteTargetType,
    targetId: string,
    activityAt: Date = new Date(),
    excludeUserId?: string,
  ): Promise<void> {
    await this.favoritePersistence.touchByTarget(
      targetType,
      targetId,
      activityAt,
      excludeUserId,
    );
  }

  async getFavoriteUserIdsForTarget(
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<string[]> {
    return this.favoritePersistence.distinctUserIdsByTarget(targetType, targetId);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.favoritePersistence.countUnread(userId);
  }

  async getUserFavorites(
    userId: string,
    options: GetFavoritesOptions = {},
  ): Promise<PaginationResult<Favorite>> {
    const pagination = PaginationHelper.parseOptions({
      page: options.page,
      pageSize: options.pageSize,
    });
    const skip = PaginationHelper.getSkip(pagination);

    const { items: favorites, total } = await this.favoritePersistence.listByUser({
      userId,
      skip,
      limit: pagination.limit ?? 20,
    });

    return PaginationHelper.createResult(
      favorites as unknown as Favorite[],
      total,
      pagination,
    );
  }
}


