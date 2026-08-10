export type FavoriteTargetType = 'publication' | 'poll' | 'project';

export const FAVORITE_PERSISTENCE_PORT = Symbol('FAVORITE_PERSISTENCE_PORT');

export interface FavoriteRecord {
  id: string;
  userId: string;
  targetType: FavoriteTargetType;
  targetId: string;
  lastViewedAt?: Date;
  lastActivityAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FavoriteListQuery {
  userId: string;
  skip: number;
  limit: number;
}

export interface FavoriteListResult {
  items: FavoriteRecord[];
  total: number;
}

/**
 * FavoritePersistencePort — user favorites (V-12).
 */
export interface FavoritePersistencePort {
  upsertFavorite(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
    id: string,
    lastViewedAt: Date,
  ): Promise<FavoriteRecord>;

  findByUserTarget(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<FavoriteRecord | null>;

  deleteFavorite(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<void>;

  exists(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<boolean>;

  countByUserId(userId: string): Promise<number>;

  markAsViewed(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
    at: Date,
  ): Promise<void>;

  touchByTarget(
    targetType: FavoriteTargetType,
    targetId: string,
    activityAt: Date,
    excludeUserId?: string,
  ): Promise<void>;

  distinctUserIdsByTarget(targetType: FavoriteTargetType, targetId: string): Promise<string[]>;

  countUnread(userId: string): Promise<number>;

  listByUser(query: FavoriteListQuery): Promise<FavoriteListResult>;
}
