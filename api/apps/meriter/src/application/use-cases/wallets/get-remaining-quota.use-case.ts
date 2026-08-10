import type { Community } from '../../../domain/models/community/community.schema';
import { CommunityService } from '../../../domain/services/community.service';

/** Minimal DB surface for quota usage aggregation (no mongoose import in application layer). */
export type QuotaUsageDb = {
  collection(name: string): {
    aggregate(pipeline: unknown[]): { toArray(): Promise<Array<{ total?: number }>> };
  };
};

export type CommunityQuotaContext = Pick<
  Community,
  'typeTag' | 'meritSettings' | 'settings' | 'lastQuotaResetAt' | 'isPriority'
>;

export type GetRemainingQuotaParams = {
  userId: string;
  communityId: string;
  community: CommunityQuotaContext;
  db: QuotaUsageDb;
};

/**
 * BC-02 inv-02: application entry for remaining daily quota (P-3).
 * Delegates to CommunityService.getRemaining*; tRPC passes explicit db handle.
 */
export class GetRemainingQuotaUseCase {
  constructor(private readonly communityService: CommunityService) {}

  /** Publication/event create fee path (meritSettings.dailyQuota, priority communities). */
  async forPublicationCreate(params: GetRemainingQuotaParams): Promise<number> {
    if (!params.db) {
      throw new Error('Database connection not available');
    }
    return this.communityService.getRemainingPublicationCreateQuota(
      params.userId,
      params.communityId,
      params.community,
      params.db,
    );
  }

  /** wallets.getQuota / member-list path (settings.dailyEmission). */
  async forDailyEmission(params: GetRemainingQuotaParams): Promise<number> {
    if (!params.db) {
      throw new Error('Database connection not available');
    }
    return this.communityService.getRemainingDailyEmissionQuota(
      params.userId,
      params.communityId,
      params.community,
      params.db,
    );
  }
}

export function createGetRemainingQuotaUseCase(ctx: {
  communityService: CommunityService;
}): GetRemainingQuotaUseCase {
  return new GetRemainingQuotaUseCase(ctx.communityService);
}
