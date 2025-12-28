import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import {
  Favorite,
  FavoriteSchemaClass,
  FavoriteDocument,
  FavoriteTargetType,
} from '../models/favorite/favorite.schema';
import { PaginationHelper, PaginationResult } from '../../common/helpers/pagination.helper';

export interface GetFavoritesOptions {
  page?: number;
  pageSize?: number;
}

@Injectable()
export class FavoriteService {
  constructor(
    @InjectModel(FavoriteSchemaClass.name)
    private readonly favoriteModel: Model<FavoriteDocument>,
  ) {}

  async addFavorite(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<FavoriteDocument> {
    const now = new Date();

    // Upsert to keep operation idempotent
    await this.favoriteModel.updateOne(
      { userId, targetType, targetId },
      {
        $setOnInsert: {
          id: uid(),
          userId,
          targetType,
          targetId,
          lastViewedAt: now, // on add, treat as "viewed" to avoid immediate unread highlight
          lastActivityAt: undefined,
        },
      },
      { upsert: true },
    );

    const doc = await this.favoriteModel.findOne({ userId, targetType, targetId }).exec();
    if (!doc) {
      // Extremely unlikely after upsert
      throw new Error('Failed to add favorite');
    }
    return doc;
  }

  async removeFavorite(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<void> {
    await this.favoriteModel.deleteOne({ userId, targetType, targetId }).exec();
  }

  async isFavorite(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<boolean> {
    const exists = await this.favoriteModel.exists({ userId, targetType, targetId });
    return !!exists;
  }

  async getFavoriteCount(userId: string): Promise<number> {
    return this.favoriteModel.countDocuments({ userId });
  }

  async markAsViewed(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<void> {
    const now = new Date();
    await this.favoriteModel.updateOne(
      { userId, targetType, targetId },
      { $set: { lastViewedAt: now } },
    );
  }

  async touchFavoritesForTarget(
    targetType: FavoriteTargetType,
    targetId: string,
    activityAt: Date = new Date(),
  ): Promise<void> {
    await this.favoriteModel.updateMany(
      { targetType, targetId },
      { $set: { lastActivityAt: activityAt } },
    );
  }

  async getFavoriteUserIdsForTarget(
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<string[]> {
    const userIds = await this.favoriteModel.distinct('userId', {
      targetType,
      targetId,
    });
    return userIds.filter((x): x is string => typeof x === 'string' && x.length > 0);
  }

  async getUnreadCount(userId: string): Promise<number> {
    // unread = there is activity after lastViewedAt (or lastViewedAt missing)
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

  async getUserFavorites(
    userId: string,
    options: GetFavoritesOptions = {},
  ): Promise<PaginationResult<Favorite>> {
    const pagination = PaginationHelper.parseOptions({
      page: options.page,
      pageSize: options.pageSize,
    });
    const skip = PaginationHelper.getSkip(pagination);

    const query = { userId };
    const total = await this.favoriteModel.countDocuments(query);

    const favorites = await this.favoriteModel
      .find(query)
      .sort({ lastActivityAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(pagination.limit ?? 20)
      .lean<Favorite[]>()
      .exec();

    return PaginationHelper.createResult(favorites, total, pagination);
  }
}


