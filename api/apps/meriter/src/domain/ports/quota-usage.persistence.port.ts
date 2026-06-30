export const QUOTA_USAGE_PERSISTENCE_PORT = Symbol('QUOTA_USAGE_PERSISTENCE_PORT');

export interface QuotaUsageRecord {
  id: string;
  userId: string;
  communityId: string;
  amountQuota: number;
  usageType:
    | 'vote'
    | 'poll_cast'
    | 'publication_creation'
    | 'poll_creation'
    | 'forward'
    | 'forward_proposal'
    | 'document_variant_proposal';
  referenceId: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface QuotaUsagePersistencePort {
  create(input: {
    id: string;
    userId: string;
    communityId: string;
    amountQuota: number;
    usageType: QuotaUsageRecord['usageType'];
    referenceId: string;
    createdAt: Date;
  }): Promise<QuotaUsageRecord>;

  sumUsedSince(
    userId: string,
    communityId: string,
    quotaStartTime: Date,
  ): Promise<number>;
}
