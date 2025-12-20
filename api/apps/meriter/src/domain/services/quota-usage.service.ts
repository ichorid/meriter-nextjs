import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { QuotaUsageSchemaClass, QuotaUsageDocument } from '../models/quota-usage/quota-usage.schema';
import type { QuotaUsage } from '../models/quota-usage/quota-usage.schema';
import { uid } from 'uid';

export type QuotaUsageType = 'vote' | 'poll_cast' | 'publication_creation' | 'poll_creation';

@Injectable()
export class QuotaUsageService {
  private readonly logger = new Logger(QuotaUsageService.name);

  constructor(
    @InjectModel(QuotaUsageSchemaClass.name) private quotaUsageModel: Model<QuotaUsageDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /**
   * Consume quota for a user in a community
   * @param userId User ID
   * @param communityId Community ID
   * @param amount Amount of quota to consume
   * @param usageType Type of usage
   * @param referenceId ID of the related entity (publication, poll, vote, poll_cast)
   * @returns Created quota usage record
   */
  async consumeQuota(
    userId: string,
    communityId: string,
    amount: number,
    usageType: QuotaUsageType,
    referenceId: string,
  ): Promise<QuotaUsage> {
    this.logger.log(
      `Consuming quota: user=${userId}, community=${communityId}, amount=${amount}, type=${usageType}, reference=${referenceId}`,
    );

    if (amount <= 0) {
      throw new BadRequestException('Quota amount must be positive');
    }

    const quotaUsage = await this.quotaUsageModel.create({
      id: uid(),
      userId,
      communityId,
      amountQuota: amount,
      usageType,
      referenceId,
      createdAt: new Date(),
    });

    this.logger.log(`Quota consumed successfully: ${quotaUsage.id}`);
    return quotaUsage.toObject();
  }

  /**
   * Get total quota used by a user in a community since a given time
   * @param userId User ID
   * @param communityId Community ID
   * @param since Start time for calculation
   * @returns Total quota used
   */
  async getQuotaUsed(
    userId: string,
    communityId: string,
    since: Date,
  ): Promise<number> {
    const result = await this.connection.db!
      .collection('quota_usage')
      .aggregate([
        {
          $match: {
            userId,
            communityId,
            createdAt: { $gte: since },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amountQuota' },
          },
        },
      ])
      .toArray();

    return result.length > 0 ? result[0].total : 0;
  }
}








