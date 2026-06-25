import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserCommunityRoleSchemaClass,
  UserCommunityRoleDocument,
} from '../../domain/models/user-community-role/user-community-role.schema';
import {
  USER_COMMUNITY_ROLE_PERSISTENCE_PORT,
  type UpsertUserCommunityRoleInput,
  type UserCommunityRolePersistencePort,
  type UserCommunityRoleRecord,
} from '../../domain/ports/user-community-role.persistence.port';

const activeMembershipFilter = {
  leftAt: null,
  membershipStatus: { $ne: 'frozen' as const },
} as const;

@Injectable()
export class UserCommunityRolePersistenceAdapter implements UserCommunityRolePersistencePort {
  constructor(
    @InjectModel(UserCommunityRoleSchemaClass.name)
    private readonly userCommunityRoleModel: Model<UserCommunityRoleDocument>,
  ) {}

  async findActiveRole(
    userId: string,
    communityId: string,
  ): Promise<UserCommunityRoleRecord | null> {
    const doc = await this.userCommunityRoleModel
      .findOne({ userId, communityId, ...activeMembershipFilter })
      .lean()
      .exec();
    return doc ? (doc as UserCommunityRoleRecord) : null;
  }

  async findAnyRole(
    userId: string,
    communityId: string,
  ): Promise<UserCommunityRoleRecord | null> {
    const doc = await this.userCommunityRoleModel.findOne({ userId, communityId }).lean().exec();
    return doc ? (doc as UserCommunityRoleRecord) : null;
  }

  async findActiveRolesByUserId(userId: string): Promise<UserCommunityRoleRecord[]> {
    const rows = await this.userCommunityRoleModel
      .find({ userId, ...activeMembershipFilter })
      .lean()
      .exec();
    return rows as UserCommunityRoleRecord[];
  }

  async findActiveByCommunityAndRole(
    communityId: string,
    role: 'lead' | 'participant',
  ): Promise<UserCommunityRoleRecord[]> {
    const rows = await this.userCommunityRoleModel
      .find({ communityId, role, ...activeMembershipFilter })
      .lean()
      .exec();
    return rows as UserCommunityRoleRecord[];
  }

  async countActiveMembersInCommunity(communityId: string): Promise<number> {
    return this.userCommunityRoleModel
      .countDocuments({ communityId, ...activeMembershipFilter })
      .exec();
  }

  async countActiveMembersInCommunities(communityIds: string[]): Promise<Map<string, number>> {
    const unique = [...new Set(communityIds.filter(Boolean))];
    const map = new Map<string, number>();
    if (unique.length === 0) {
      return map;
    }
    const rows = await this.userCommunityRoleModel
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            communityId: { $in: unique },
            ...activeMembershipFilter,
          },
        },
        { $group: { _id: '$communityId', count: { $sum: 1 } } },
      ])
      .exec();
    for (const r of rows) {
      map.set(r._id, r.count);
    }
    for (const id of unique) {
      if (!map.has(id)) {
        map.set(id, 0);
      }
    }
    return map;
  }

  async distinctActiveMemberUserIds(communityId: string): Promise<string[]> {
    return this.userCommunityRoleModel
      .distinct('userId', { communityId, ...activeMembershipFilter })
      .exec();
  }

  async distinctActiveUserIdsByRole(role: 'lead' | 'participant'): Promise<string[]> {
    return this.userCommunityRoleModel
      .distinct('userId', { role, ...activeMembershipFilter })
      .exec();
  }

  async findActiveCommunitiesByUserAndRole(
    userId: string,
    role: 'lead' | 'participant',
  ): Promise<string[]> {
    const rows = await this.userCommunityRoleModel
      .find({ userId, role, ...activeMembershipFilter })
      .lean()
      .exec();
    return rows.map((r) => r.communityId);
  }

  async upsertRole(input: UpsertUserCommunityRoleInput): Promise<UserCommunityRoleRecord> {
    const result = await this.userCommunityRoleModel
      .findOneAndUpdate(
        { userId: input.userId, communityId: input.communityId },
        {
          $set: {
            role: input.role,
            updatedAt: input.updatedAt,
            membershipStatus: 'active',
          },
          $unset: { leftAt: 1 },
          $setOnInsert: {
            id: input.id,
            userId: input.userId,
            communityId: input.communityId,
            createdAt: input.createdAt,
          },
        },
        { new: true, upsert: true, runValidators: true },
      )
      .lean()
      .exec();
    if (!result) {
      throw new Error(
        `Failed to set role for user ${input.userId} in community ${input.communityId}`,
      );
    }
    return result as UserCommunityRoleRecord;
  }

  async sumFrozenInternalMerits(communityId: string): Promise<number> {
    const result = await this.userCommunityRoleModel
      .aggregate<{ total: number }>([
        { $match: { communityId, frozenInternalMerits: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$frozenInternalMerits' } } },
      ])
      .exec();
    return result[0]?.total ?? 0;
  }

  async markLeftProject(
    userId: string,
    communityId: string,
    frozenInternalMerits: number,
    updatedAt: Date,
  ): Promise<void> {
    await this.userCommunityRoleModel
      .updateOne(
        { userId, communityId },
        {
          $set: {
            frozenInternalMerits: Math.max(0, frozenInternalMerits),
            leftAt: updatedAt,
            updatedAt,
          },
        },
      )
      .exec();
  }

  async setMembershipStatus(
    userId: string,
    communityId: string,
    membershipStatus: 'active' | 'frozen',
    updatedAt: Date,
  ): Promise<void> {
    await this.userCommunityRoleModel
      .updateOne(
        { userId, communityId },
        { $set: { membershipStatus, updatedAt } },
      )
      .exec();
  }

  async setLeadGraceUntil(
    userId: string,
    communityId: string,
    leadGraceUntil: Date | null,
    updatedAt: Date,
  ): Promise<void> {
    await this.userCommunityRoleModel
      .updateOne(
        { userId, communityId },
        { $set: { leadGraceUntil, updatedAt } },
      )
      .exec();
  }

  async deleteRole(userId: string, communityId: string): Promise<void> {
    await this.userCommunityRoleModel.deleteOne({ userId, communityId }).exec();
  }

  async distinctUserIdsInCommunity(communityId: string): Promise<string[]> {
    return this.userCommunityRoleModel.distinct('userId', { communityId }).exec();
  }
}

export const userCommunityRolePersistenceProvider = {
  provide: USER_COMMUNITY_ROLE_PERSISTENCE_PORT,
  useClass: UserCommunityRolePersistenceAdapter,
};
