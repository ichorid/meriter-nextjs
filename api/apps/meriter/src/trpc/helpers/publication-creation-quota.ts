import type { Connection } from 'mongoose';
import { isPriorityCommunity } from '../../domain/common/helpers/community.helper';
import type { Community } from '../../domain/models/community/community.schema';
import type { CommunityService } from '../../domain/services/community.service';

/**
 * Remaining daily quota for publication creation (same rules as publications.create).
 */
type CommunityQuotaSlice = {
  typeTag?: string;
  isPriority?: boolean;
  meritSettings?: { quotaEnabled?: boolean };
  lastQuotaResetAt?: Date | string;
};

export async function getRemainingQuotaForPublicationCreate(
  userId: string,
  communityId: string,
  community: CommunityQuotaSlice,
  communityService: Pick<CommunityService, 'getEffectiveMeritSettings'>,
  connection: Pick<Connection, 'db'>,
): Promise<number> {
  if (isPriorityCommunity(community)) {
    return 0;
  }

  if (community.meritSettings?.quotaEnabled === false) {
    return 0;
  }

  const effectiveMeritSettings = communityService.getEffectiveMeritSettings(
    community as Pick<Community, 'typeTag' | 'meritSettings'>,
  );
  const dailyQuota =
    typeof effectiveMeritSettings?.dailyQuota === 'number' ? effectiveMeritSettings.dailyQuota : 0;

  if (dailyQuota <= 0) {
    return 0;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const quotaStartTime = community.lastQuotaResetAt
    ? new Date(community.lastQuotaResetAt)
    : today;

  if (!connection.db) {
    throw new Error('Database connection not available');
  }

  const [votesUsed, pollCastsUsed, quotaUsageUsed] = await Promise.all([
    connection.db
      .collection('votes')
      .aggregate([
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
      ])
      .toArray(),
    connection.db
      .collection('poll_casts')
      .aggregate([
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
      ])
      .toArray(),
    connection.db
      .collection('quota_usage')
      .aggregate([
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
      ])
      .toArray(),
  ]);

  const votesTotal = votesUsed.length > 0 && votesUsed[0] ? (votesUsed[0].total as number) : 0;
  const pollCastsTotal =
    pollCastsUsed.length > 0 && pollCastsUsed[0] ? (pollCastsUsed[0].total as number) : 0;
  const quotaUsageTotal =
    quotaUsageUsed.length > 0 && quotaUsageUsed[0] ? (quotaUsageUsed[0].total as number) : 0;
  const used = votesTotal + pollCastsTotal + quotaUsageTotal;

  return Math.max(0, dailyQuota - used);
}
