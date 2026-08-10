import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  QuotaUsageSchemaClass,
  QuotaUsageDocument,
} from '../../domain/models/quota-usage/quota-usage.schema';
import {
  QUOTA_USAGE_PERSISTENCE_PORT,
  type QuotaUsagePersistencePort,
  type QuotaUsageRecord,
} from '../../domain/ports/quota-usage.persistence.port';

function toRecord(doc: QuotaUsageDocument | Record<string, unknown>): QuotaUsageRecord {
  const row =
    'toObject' in doc && typeof doc.toObject === 'function'
      ? doc.toObject()
      : doc;
  return {
    id: row.id as string,
    userId: row.userId as string,
    communityId: row.communityId as string,
    amountQuota: row.amountQuota as number,
    usageType: row.usageType as QuotaUsageRecord['usageType'],
    referenceId: row.referenceId as string,
    createdAt: row.createdAt as Date,
    updatedAt: (row.updatedAt as Date | undefined) ?? (row.createdAt as Date),
  };
}

@Injectable()
export class QuotaUsagePersistenceAdapter implements QuotaUsagePersistencePort {
  constructor(
    @InjectModel(QuotaUsageSchemaClass.name)
    private readonly quotaUsageModel: Model<QuotaUsageDocument>,
  ) {}

  async create(input: {
    id: string;
    userId: string;
    communityId: string;
    amountQuota: number;
    usageType: QuotaUsageRecord['usageType'];
    referenceId: string;
    createdAt: Date;
  }): Promise<QuotaUsageRecord> {
    const doc = await this.quotaUsageModel.create(input);
    return toRecord(doc);
  }

  async sumUsedSince(
    userId: string,
    communityId: string,
    quotaStartTime: Date,
  ): Promise<number> {
    const pipeline = [
      {
        $match: {
          userId,
          communityId,
          createdAt: { $gte: quotaStartTime },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amountQuota' },
        },
      },
    ];
    const rows = await this.quotaUsageModel
      .aggregate<Array<{ _id: null; total: number }>>(pipeline)
      .exec();
    return rows.length > 0 && rows[0] ? rows[0].total : 0;
  }
}

export const quotaUsagePersistenceProvider = {
  provide: QUOTA_USAGE_PERSISTENCE_PORT,
  useClass: QuotaUsagePersistenceAdapter,
};
