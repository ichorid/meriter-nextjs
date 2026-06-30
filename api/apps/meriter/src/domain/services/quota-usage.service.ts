import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import type { QuotaUsage } from '../models/quota-usage/quota-usage.schema';
import { uid } from 'uid';
import {
  QUOTA_USAGE_PERSISTENCE_PORT,
  type QuotaUsagePersistencePort,
} from '../ports/quota-usage.persistence.port';

export type QuotaUsageType =
  | 'vote'
  | 'poll_cast'
  | 'publication_creation'
  | 'poll_creation'
  | 'forward'
  | 'forward_proposal'
  | 'document_variant_proposal';

@Injectable()
export class QuotaUsageService {
  private readonly logger = new Logger(QuotaUsageService.name);

  constructor(
    @Inject(QUOTA_USAGE_PERSISTENCE_PORT)
    private readonly quotaUsagePersistence: QuotaUsagePersistencePort,
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

    const quotaUsage = await this.quotaUsagePersistence.create({
      id: uid(),
      userId,
      communityId,
      amountQuota: amount,
      usageType,
      referenceId,
      createdAt: new Date(),
    });

    this.logger.log(`Quota consumed successfully: ${quotaUsage.id}`);
    return {
      id: quotaUsage.id,
      userId: quotaUsage.userId,
      communityId: quotaUsage.communityId,
      amountQuota: quotaUsage.amountQuota,
      usageType: quotaUsage.usageType,
      referenceId,
      createdAt: quotaUsage.createdAt,
    };
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
    return this.quotaUsagePersistence.sumUsedSince(userId, communityId, since);
  }
}








