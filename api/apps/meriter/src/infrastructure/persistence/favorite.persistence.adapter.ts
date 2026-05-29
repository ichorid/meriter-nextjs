import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  FavoriteSchemaClass,
  FavoriteDocument,
} from '../../domain/models/favorite/favorite.schema';
import {
  FAVORITE_PERSISTENCE_PORT,
  type FavoriteListQuery,
  type FavoriteListResult,
  type FavoritePersistencePort,
  type FavoriteRecord,
  type FavoriteTargetType,
} from '../../domain/ports/favorite.persistence.port';

@Injectable()
export class FavoritePersistenceAdapter implements FavoritePersistencePort {
  constructor(
    @InjectModel(FavoriteSchemaClass.name)
    private readonly favoriteModel: Model<FavoriteDocument>,
  ) {}

  async upsertFavorite(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
    id: string,
    lastViewedAt: Date,
  ): Promise<FavoriteRecord> {
    await this.favoriteModel.updateOne(
      { userId, targetType, targetId },
      {
        $setOnInsert: {
          id,
          userId,
          targetType,
          targetId,
          lastViewedAt,
          lastActivityAt: undefined,
        },
      },
      { upsert: true },
    );

    const doc = await this.favoriteModel.findOne({ userId, targetType, targetId }).exec();
    if (!doc) {
      throw new Error('Failed to add favorite');
    }
    return doc.toObject() as FavoriteRecord;
  }

  async findByUserTarget(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<FavoriteRecord | null> {
    const doc = await this.favoriteModel.findOne({ userId, targetType, targetId }).exec();
    return doc ? (doc.toObject() as FavoriteRecord) : null;
  }

  async deleteFavorite(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<void> {
    await this.favoriteModel.deleteOne({ userId, targetType, targetId }).exec();
  }

  async exists(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<boolean> {
    const found = await this.favoriteModel.exists({ userId, targetType, targetId });
    return !!found;
  }

  async countByUserId(userId: string): Promise<number> {
    return this.favoriteModel.countDocuments({ userId });
  }

  async markAsViewed(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
    at: Date,
  ): Promise<void> {
    await this.favoriteModel.updateOne(
      { userId, targetType, targetId },
      { $set: { lastViewedAt: at } },
    );
  }

  async touchByTarget(
    targetType: FavoriteTargetType,
    targetId: string,
    activityAt: Date,
    excludeUserId?: string,
  ): Promise<void> {
    const filter: Record<string, unknown> = { targetType, targetId };
    if (excludeUserId) {
      filter.userId = { $ne: excludeUserId };
    }
    await this.favoriteModel.updateMany(filter, { $set: { lastActivityAt: activityAt } });
  }

  async distinctUserIdsByTarget(
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<string[]> {
    const userIds = await this.favoriteModel.distinct('userId', { targetType, targetId });
    return userIds.filter((x): x is string => typeof x === 'string' && x.length > 0);
  }

  async countUnread(userId: string): Promise<number> {
    const result = await this.favoriteModel
      .aggregate<{ count: number }>([
        { $match: { userId, lastActivityAt: { $exists: true } } },
        {
          $match: {
            $expr: {
              $gt: ['$lastActivityAt', { $ifNull: ['$lastViewedAt', new Date(0)] }],
            },
          },
        },
        { $count: 'count' },
      ])
      .exec();

    return result[0]?.count ?? 0;
  }

  async listByUser(query: FavoriteListQuery): Promise<FavoriteListResult> {
    const filter = { userId: query.userId };
    const total = await this.favoriteModel.countDocuments(filter);
    const items = await this.favoriteModel
      .find(filter)
      .sort({ lastActivityAt: -1, createdAt: -1 })
      .skip(query.skip)
      .limit(query.limit)
      .lean<FavoriteRecord[]>()
      .exec();

    return { items, total };
  }
}

export const favoritePersistenceProvider = {
  provide: FAVORITE_PERSISTENCE_PORT,
  useClass: FavoritePersistenceAdapter,
};
