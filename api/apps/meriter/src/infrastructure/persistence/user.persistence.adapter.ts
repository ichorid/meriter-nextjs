import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserSchemaClass,
  UserDocument,
} from '../../domain/models/user/user.schema';
import {
  USER_PERSISTENCE_PORT,
  type UserPersistencePort,
  type UserRecord,
  type AggregateCommunityMembersParams,
  type AggregateCommunityMembersResult,
  type AggregateCommunityMemberRow,
} from '../../domain/ports/user.persistence.port';

type FacetAggregationRow = {
  data?: AggregateCommunityMemberRow[];
  totalCount?: Array<{ count?: number }>;
};

@Injectable()
export class UserPersistenceAdapter implements UserPersistencePort {
  constructor(
    @InjectModel(UserSchemaClass.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async indexExists(indexName: string): Promise<boolean> {
    return this.userModel.collection.indexExists(indexName);
  }

  async dropIndex(indexName: string): Promise<void> {
    await this.userModel.collection.dropIndex(indexName);
  }

  async findById(id: string): Promise<UserRecord | null> {
    const row = await this.userModel.findOne({ id }).lean().exec();
    return row ? (row as UserRecord) : null;
  }

  async findByAuth(
    authProvider: string,
    authId: string,
  ): Promise<UserRecord | null> {
    const row = await this.userModel
      .findOne({ authProvider, authId })
      .lean()
      .exec();
    return row ? (row as UserRecord) : null;
  }

  async findByToken(token: string): Promise<UserRecord | null> {
    const row = await this.userModel.findOne({ token }).lean().exec();
    return row ? (row as UserRecord) : null;
  }

  async findByCredentialId(credentialId: string): Promise<UserRecord | null> {
    const row = await this.userModel
      .findOne({ 'authenticators.credentialID': credentialId })
      .lean()
      .exec();
    return row ? (row as UserRecord) : null;
  }

  async findByUsername(username: string): Promise<UserRecord | null> {
    const row = await this.userModel.findOne({ username }).lean().exec();
    return row ? (row as UserRecord) : null;
  }

  async findForEnrichment(
    ids: string[],
  ): Promise<Array<Pick<UserRecord, 'id' | 'displayName' | 'avatarUrl'>>> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.userModel
      .find({ id: { $in: ids } })
      .select({ id: 1, displayName: 1, avatarUrl: 1 })
      .lean()
      .exec();
    return rows as Array<Pick<UserRecord, 'id' | 'displayName' | 'avatarUrl'>>;
  }

  async findForDisplayNames(
    ids: string[],
  ): Promise<Array<Pick<UserRecord, 'id' | 'displayName'>>> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.userModel
      .find({ id: { $in: ids } })
      .select({ id: 1, displayName: 1 })
      .lean()
      .exec();
    return rows as Array<Pick<UserRecord, 'id' | 'displayName'>>;
  }

  async updateByAuth(
    authProvider: string,
    authId: string,
    set: Record<string, unknown>,
  ): Promise<void> {
    await this.userModel.updateOne({ authProvider, authId }, { $set: set }).exec();
  }

  async create(input: UserRecord): Promise<void> {
    await this.userModel.create([input]);
  }

  async updateById(id: string, set: Record<string, unknown>): Promise<void> {
    await this.userModel.updateOne({ id }, { $set: set }).exec();
  }

  async setGlobalRole(
    userId: string,
    role: 'superadmin' | undefined,
    updatedAt: Date,
  ): Promise<UserRecord | null> {
    const row = await this.userModel
      .findOneAndUpdate(
        { id: userId },
        { $set: { globalRole: role, updatedAt } },
        { new: true },
      )
      .lean()
      .exec();
    return row ? (row as UserRecord) : null;
  }

  async addCommunityMembership(userId: string, communityId: string): Promise<void> {
    await this.userModel
      .updateOne(
        { id: userId },
        { $addToSet: { communityMemberships: communityId }, $set: { updatedAt: new Date() } },
      )
      .exec();
  }

  async removeCommunityMembership(
    userId: string,
    communityId: string,
  ): Promise<void> {
    await this.userModel
      .updateOne(
        { id: userId },
        { $pull: { communityMemberships: communityId }, $set: { updatedAt: new Date() } },
      )
      .exec();
  }

  async getCommunityMemberships(userId: string): Promise<string[]> {
    const row = await this.userModel
      .findOne({ id: userId })
      .select({ communityMemberships: 1 })
      .lean()
      .exec();
    return (row?.communityMemberships ?? []) as string[];
  }

  async isMemberOfCommunity(userId: string, communityId: string): Promise<boolean> {
    const row = await this.userModel
      .findOne({ id: userId, communityMemberships: communityId })
      .select({ id: 1 })
      .lean()
      .exec();
    return row !== null;
  }

  async findAll(limit: number, skip: number): Promise<UserRecord[]> {
    const rows = await this.userModel
      .find({})
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return rows as UserRecord[];
  }

  async findByCommunity(
    communityId: string,
    limit: number,
    skip: number,
  ): Promise<UserRecord[]> {
    const rows = await this.userModel
      .find({ communityMemberships: communityId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return rows as UserRecord[];
  }

  async search(query: string, limit: number): Promise<UserRecord[]> {
    const regex = new RegExp(query, 'i');
    const rows = await this.userModel
      .find({
        $or: [
          { username: regex },
          { displayName: regex },
          { firstName: regex },
          { lastName: regex },
          { 'profile.contacts.email': regex },
        ],
      })
      .limit(limit)
      .lean()
      .exec();
    return rows as UserRecord[];
  }

  async findAllUserIds(): Promise<string[]> {
    const rows = await this.userModel.find({}).select({ id: 1 }).lean().exec();
    return rows.map((row) => row.id as string);
  }

  private memberQuotaUsedLookupStage(
    collection: 'votes' | 'poll_casts' | 'quota_usage',
    communityId: string,
    quotaStartTime: Date,
    asField: string,
  ): Record<string, unknown> {
    return {
      $lookup: {
        from: collection,
        let: { userId: '$id', communityId, quotaStartTime },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$userId', '$$userId'] },
                  { $eq: ['$communityId', '$$communityId'] },
                  { $gt: ['$amountQuota', 0] },
                  { $gte: ['$createdAt', '$$quotaStartTime'] },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amountQuota' },
            },
          },
        ],
        as: asField,
      },
    };
  }

  async aggregateCommunityMembers(
    params: AggregateCommunityMembersParams,
  ): Promise<AggregateCommunityMembersResult> {
    const searchFilter: Record<string, unknown> = { id: { $in: params.memberIds } };
    if (params.search && params.search.trim()) {
      const escapedSearch = params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      searchFilter.$or = [{ username: searchRegex }, { displayName: searchRegex }];
    }

    if (params.memberIds.length === 0) {
      return { members: [], total: 0 };
    }

    const rows = await this.userModel
      .aggregate<FacetAggregationRow>([
        { $match: searchFilter },
        {
          $lookup: {
            from: 'user_community_roles',
            let: { userId: '$id', communityId: params.communityId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$userId', '$$userId'] },
                      { $eq: ['$communityId', '$$communityId'] },
                    ],
                  },
                },
              },
              { $limit: 1 },
            ],
            as: 'roleData',
          },
        },
        {
          $lookup: {
            from: 'wallets',
            let: { userId: '$id', communityId: params.communityId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$userId', '$$userId'] },
                      { $eq: ['$communityId', '$$communityId'] },
                    ],
                  },
                },
              },
              { $limit: 1 },
            ],
            as: 'walletData',
          },
        },
        {
          $addFields: {
            userRole: { $arrayElemAt: ['$roleData.role', 0] },
            dailyEmission: params.dailyEmission,
            quotaStartTime: params.quotaStartTime,
            isFutureVision: params.isFutureVision,
          },
        },
        this.memberQuotaUsedLookupStage(
          'votes',
          params.communityId,
          params.quotaStartTime,
          'votesQuota',
        ),
        this.memberQuotaUsedLookupStage(
          'poll_casts',
          params.communityId,
          params.quotaStartTime,
          'pollCastsQuota',
        ),
        this.memberQuotaUsedLookupStage(
          'quota_usage',
          params.communityId,
          params.quotaStartTime,
          'quotaUsageQuota',
        ),
        {
          $addFields: {
            votesTotal: { $ifNull: [{ $arrayElemAt: ['$votesQuota.total', 0] }, 0] },
            pollCastsTotal: {
              $ifNull: [{ $arrayElemAt: ['$pollCastsQuota.total', 0] }, 0],
            },
            quotaUsageTotal: {
              $ifNull: [{ $arrayElemAt: ['$quotaUsageQuota.total', 0] }, 0],
            },
          },
        },
        {
          $addFields: {
            usedToday: { $add: ['$votesTotal', '$pollCastsTotal', '$quotaUsageTotal'] },
            effectiveDailyEmission: {
              $cond: {
                if: { $eq: ['$isFutureVision', true] },
                then: 0,
                else: '$dailyEmission',
              },
            },
          },
        },
        {
          $project: {
            id: 1,
            username: 1,
            displayName: 1,
            avatarUrl: 1,
            globalRole: 1,
            role: '$userRole',
            walletBalance: { $arrayElemAt: ['$walletData.balance', 0] },
            quota: {
              dailyEmission: '$effectiveDailyEmission',
              usedToday: '$usedToday',
            },
          },
        },
        {
          $facet: {
            data: [{ $skip: params.skip }, { $limit: params.limit }],
            totalCount: [{ $count: 'count' }],
          },
        },
      ])
      .exec();

    const facetResult = rows[0] ?? { data: [], totalCount: [] };
    const members = (facetResult.data ?? []).map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      globalRole: row.globalRole,
      role: row.role,
      walletBalance: row.walletBalance,
      quota: row.quota
        ? {
            dailyEmission: row.quota.dailyEmission ?? 0,
            usedToday: row.quota.usedToday ?? 0,
          }
        : undefined,
    }));
    const total = facetResult.totalCount?.[0]?.count ?? 0;
    return { members, total };
  }
}

export const userPersistenceProvider = {
  provide: USER_PERSISTENCE_PORT,
  useClass: UserPersistenceAdapter,
};
