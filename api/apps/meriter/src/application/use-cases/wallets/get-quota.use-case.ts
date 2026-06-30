import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Connection } from 'mongoose';
import type { Community } from '../../../domain/models/community/community.schema';
import { CommunityService } from '../../../domain/services/community.service';
import { PermissionService } from '../../../domain/services/permission.service';
import type { QuotaUsageDb } from './get-remaining-quota.use-case';

export type QuotaSnapshot = {
  dailyQuota: number;
  used: number;
  remaining: number;
  resetAt: string;
};

export class GetQuotaUseCase {
  constructor(
    private readonly communityService: CommunityService,
    private readonly permissionService: PermissionService,
    private readonly connection: Connection,
  ) {}

  async getQuota(input: {
    viewerId: string;
    userId: string;
    communityId: string;
  }): Promise<QuotaSnapshot> {
    const canView = await this.permissionService.canViewUserMerits(
      input.viewerId,
      input.userId,
      input.communityId,
    );
    if (!canView) {
      throw new ForbiddenException(
        "You do not have permission to view this user's quota",
      );
    }

    const community = await this.communityService.getCommunity(input.communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    return this.buildQuotaSnapshot(input.userId, community);
  }

  async getQuotaBatch(input: {
    userId: string;
    communityIds: string[];
  }): Promise<Record<string, QuotaSnapshot>> {
    if (input.communityIds.length === 0) {
      return {};
    }

    const communities = await this.communityService.listCommunitiesByIds(
      input.communityIds,
    );
    const db = this.requireDb();

    const communityQuotaConfig = new Map<
      string,
      { dailyQuota: number; quotaStartTime: Date }
    >();
    for (const community of communities) {
      const dailyQuota = this.communityService.getDailyEmissionCapForQuota(community);
      communityQuotaConfig.set(community.id, {
        dailyQuota,
        quotaStartTime: this.communityService.getQuotaStartTime(community),
      });
    }

    const startTimeGroups = new Map<number, string[]>();
    for (const [communityId, config] of communityQuotaConfig) {
      const key = config.quotaStartTime.getTime();
      if (!startTimeGroups.has(key)) {
        startTimeGroups.set(key, []);
      }
      startTimeGroups.get(key)!.push(communityId);
    }

    const aggregateUsage = async (
      collection: string,
      ids: string[],
      since: Date,
    ): Promise<Array<{ _id: string; total: number }>> =>
      db
        .collection(collection)
        .aggregate<{ _id: string; total: number }>([
          {
            $match: {
              userId: input.userId,
              communityId: { $in: ids },
              createdAt: { $gte: since },
            },
          },
          { $group: { _id: '$communityId', total: { $sum: '$amountQuota' } } },
        ])
        .toArray();

    const usedMap = new Map<string, number>();
    for (const [startTimeMs, ids] of startTimeGroups) {
      const since = new Date(startTimeMs);
      const [votesResults, pollCastsResults, quotaUsageResults] = await Promise.all([
        aggregateUsage('votes', ids, since),
        aggregateUsage('poll_casts', ids, since),
        aggregateUsage('quota_usage', ids, since),
      ]);
      for (const row of [...votesResults, ...pollCastsResults, ...quotaUsageResults]) {
        usedMap.set(row._id, (usedMap.get(row._id) || 0) + row.total);
      }
    }

    const result: Record<string, QuotaSnapshot> = {};
    for (const [communityId, config] of communityQuotaConfig) {
      const usedRaw = usedMap.get(communityId) || 0;
      const used = config.dailyQuota === 0 ? 0 : usedRaw;
      const remaining =
        config.dailyQuota === 0
          ? 0
          : this.communityService.computeRemainingQuota(config.dailyQuota, used);

      result[communityId] = {
        dailyQuota: config.dailyQuota,
        used,
        remaining,
        resetAt: this.computeResetAt(config.quotaStartTime),
      };
    }

    return result;
  }

  async getFreeBalance(input: {
    userId: string;
    communityId: string;
  }): Promise<number> {
    const community = await this.communityService.getCommunity(input.communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const snapshot = await this.buildQuotaSnapshot(input.userId, community, {
      ignoreQuotaEnabledForCap: true,
    });
    return snapshot.remaining;
  }

  private async buildQuotaSnapshot(
    userId: string,
    community: Community,
    options?: { ignoreQuotaEnabledForCap?: boolean },
  ): Promise<QuotaSnapshot> {
    const dailyQuota = options?.ignoreQuotaEnabledForCap
      ? community.typeTag === 'future-vision'
        ? 0
        : (community.settings?.dailyEmission ?? 0)
      : this.communityService.getDailyEmissionCapForQuota(community);

    const quotaStartTime = this.communityService.getQuotaStartTime(community);
    const db = this.requireDb();

    const usedRaw = await this.communityService.aggregateQuotaUsedSince(
      userId,
      community.id,
      quotaStartTime,
      db as QuotaUsageDb,
    );
    const used = dailyQuota === 0 ? 0 : usedRaw;
    const remaining =
      dailyQuota === 0
        ? 0
        : this.communityService.computeRemainingQuota(dailyQuota, used);

    return {
      dailyQuota,
      used,
      remaining,
      resetAt: this.computeResetAt(quotaStartTime),
    };
  }

  private computeResetAt(quotaStartTime: Date): string {
    const resetAt = new Date(quotaStartTime);
    resetAt.setDate(resetAt.getDate() + 1);
    resetAt.setHours(0, 0, 0, 0);
    return resetAt.toISOString();
  }

  private requireDb(): NonNullable<Connection['db']> {
    if (!this.connection.db) {
      throw new InternalServerErrorException('Database connection not available');
    }
    return this.connection.db;
  }
}

export function createGetQuotaUseCase(deps: {
  communityService: CommunityService;
  permissionService: PermissionService;
  connection: Connection;
}): GetQuotaUseCase {
  return new GetQuotaUseCase(
    deps.communityService,
    deps.permissionService,
    deps.connection,
  );
}

export function createGetQuotaUseCaseFromContext(ctx: {
  communityService: CommunityService;
  permissionService: PermissionService;
  connection: Connection;
}): GetQuotaUseCase {
  return createGetQuotaUseCase(ctx);
}
