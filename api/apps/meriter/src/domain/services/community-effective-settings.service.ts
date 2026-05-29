import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { isPriorityCommunity } from '../common/helpers/community.helper';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';
import type {
  Community,
  CommunityMeritSettings,
  CommunityVotingSettings,
  PermissionRule,
} from '../models/community/community.schema';
import { CommunityDefaultsService } from './community-defaults.service';

/**
 * Effective community settings merge (defaults + DB overrides) and quota window math.
 * Extracted from CommunityService for common-closure (CA Phase 4).
 */
@Injectable()
export class CommunityEffectiveSettingsService {
  constructor(
    private readonly communityDefaultsService: CommunityDefaultsService,
    @InjectConnection() private readonly mongoose: Connection,
  ) {}

  getEffectivePermissionRules(community: Community): PermissionRule[] {
    const defaultRules = this.communityDefaultsService.getDefaultPermissionRules(
      community.typeTag,
    );

    if (!community.permissionRules || community.permissionRules.length === 0) {
      return defaultRules;
    }

    const defaultRulesMap = new Map<string, PermissionRule>();
    for (const rule of defaultRules) {
      defaultRulesMap.set(`${rule.role}:${rule.action}`, rule);
    }

    const mergedRules: PermissionRule[] = [];
    const processedKeys = new Set<string>();

    for (const dbRule of community.permissionRules) {
      const key = `${dbRule.role}:${dbRule.action}`;
      const defaultRule = defaultRulesMap.get(key);
      const mergedConditions = defaultRule?.conditions
        ? { ...defaultRule.conditions, ...dbRule.conditions }
        : dbRule.conditions;

      mergedRules.push({
        ...dbRule,
        conditions:
          mergedConditions && Object.keys(mergedConditions).length > 0
            ? mergedConditions
            : undefined,
      });
      processedKeys.add(key);
    }

    for (const defaultRule of defaultRules) {
      const key = `${defaultRule.role}:${defaultRule.action}`;
      if (!processedKeys.has(key)) {
        mergedRules.push(defaultRule);
      }
    }

    return mergedRules;
  }

  getEffectiveMeritSettings(
    community: Pick<Community, 'typeTag' | 'meritSettings'>,
  ): CommunityMeritSettings {
    const defaults = this.communityDefaultsService.getDefaultMeritSettings(
      community.typeTag,
    );

    if (!community.meritSettings) {
      return defaults;
    }

    const effectiveSettings = {
      ...defaults,
      ...community.meritSettings,
      quotaRecipients:
        community.meritSettings.quotaRecipients ?? defaults.quotaRecipients,
    };

    if (effectiveSettings.startingMerits === undefined) {
      effectiveSettings.startingMerits = effectiveSettings.dailyQuota;
    }

    return effectiveSettings;
  }

  getEffectiveVotingSettings(community: Community): CommunityVotingSettings {
    const defaults = this.communityDefaultsService.getDefaultVotingSettings(
      community.typeTag,
    );

    if (!community.votingSettings) {
      return defaults;
    }

    return {
      ...defaults,
      ...community.votingSettings,
      votingRestriction:
        community.votingSettings.votingRestriction ?? defaults.votingRestriction,
      currencySource:
        community.votingSettings.currencySource ?? defaults.currencySource,
      meritConversion:
        community.votingSettings.meritConversion ?? defaults.meritConversion,
    };
  }

  getQuotaStartTime(community: Pick<Community, 'lastQuotaResetAt'>): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return community.lastQuotaResetAt
      ? new Date(community.lastQuotaResetAt)
      : today;
  }

  getDailyEmissionCapForQuota(
    community: Pick<Community, 'typeTag' | 'meritSettings' | 'settings'>,
  ): number {
    const quotaEnabled = community.meritSettings?.quotaEnabled !== false;
    const baseDailyEmission = quotaEnabled
      ? (community.settings?.dailyEmission ?? 0)
      : 0;
    if (!quotaEnabled || community.typeTag === 'future-vision') {
      return 0;
    }
    return baseDailyEmission;
  }

  getPublicationCreateDailyCap(
    community: Pick<Community, 'typeTag' | 'meritSettings'>,
  ): number {
    if (isPriorityCommunity(community)) {
      return 0;
    }
    if (community.meritSettings?.quotaEnabled === false) {
      return 0;
    }
    const effectiveMeritSettings = this.getEffectiveMeritSettings(community);
    const dailyQuota =
      typeof effectiveMeritSettings?.dailyQuota === 'number'
        ? effectiveMeritSettings.dailyQuota
        : 0;
    return dailyQuota <= 0 ? 0 : dailyQuota;
  }

  computeRemainingQuota(dailyCap: number, used: number): number {
    return dailyCap <= 0 ? 0 : Math.max(0, dailyCap - used);
  }

  async getRemainingPublicationCreateQuota(
    userId: string,
    communityId: string,
    community: Pick<
      Community,
      'typeTag' | 'meritSettings' | 'settings' | 'lastQuotaResetAt' | 'isPriority'
    >,
    dbOverride?: Parameters<CommunityEffectiveSettingsService['aggregateQuotaUsedSince']>[3],
  ): Promise<number> {
    const dailyCap = this.getPublicationCreateDailyCap(community);
    if (dailyCap <= 0) {
      return 0;
    }
    const used = await this.aggregateQuotaUsedSince(
      userId,
      communityId,
      this.getQuotaStartTime(community),
      dbOverride,
    );
    return this.computeRemainingQuota(dailyCap, used);
  }

  async getRemainingDailyEmissionQuota(
    userId: string,
    communityId: string,
    community: Pick<
      Community,
      'typeTag' | 'meritSettings' | 'settings' | 'lastQuotaResetAt'
    >,
    dbOverride?: Parameters<CommunityEffectiveSettingsService['aggregateQuotaUsedSince']>[3],
  ): Promise<number> {
    const dailyCap = this.getDailyEmissionCapForQuota(community);
    if (dailyCap <= 0) {
      return 0;
    }
    const used = await this.aggregateQuotaUsedSince(
      userId,
      communityId,
      this.getQuotaStartTime(community),
      dbOverride,
    );
    return this.computeRemainingQuota(dailyCap, used);
  }

  private quotaUsedAggregationPipeline(
    userId: string,
    communityId: string,
    quotaStartTime: Date,
  ): unknown[] {
    return [
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
  }

  private sumQuotaAggregationTotal(rows: Array<{ total?: number }>): number {
    return rows.length > 0 && rows[0] ? (rows[0].total as number) : 0;
  }

  async aggregateQuotaUsedSince(
    userId: string,
    communityId: string,
    quotaStartTime: Date,
    dbOverride?: {
      collection(name: string): {
        aggregate(pipeline: unknown[]): { toArray(): Promise<Array<{ total?: number }>> };
      };
    },
  ): Promise<number> {
    const db = dbOverride ?? this.mongoose.db;
    if (!db) {
      throw new Error('Database connection not available');
    }
    const pipeline = this.quotaUsedAggregationPipeline(
      userId,
      communityId,
      quotaStartTime,
    );
    const [votesUsed, pollCastsUsed, quotaUsageUsed] = await Promise.all([
      db.collection('votes').aggregate(pipeline).toArray(),
      db.collection('poll_casts').aggregate(pipeline).toArray(),
      db.collection('quota_usage').aggregate(pipeline).toArray(),
    ]);

    return (
      this.sumQuotaAggregationTotal(votesUsed) +
      this.sumQuotaAggregationTotal(pollCastsUsed) +
      this.sumQuotaAggregationTotal(quotaUsageUsed)
    );
  }

  startingMeritsOnJoin(community: Community): number {
    if (!community?.id || community.id === GLOBAL_COMMUNITY_ID) {
      return 0;
    }
    const effective = this.getEffectiveMeritSettings(community);
    const raw = effective.startingMerits ?? effective.dailyQuota ?? 0;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      return 0;
    }
    return Math.floor(n);
  }
}
