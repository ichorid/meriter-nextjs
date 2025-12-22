import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../models/community/community.schema';
import type {
  Community,
  PermissionRule,
  CommunityMeritSettings,
  CommunityVotingSettings,
} from '../models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../models/user/user.schema';
import type { User } from '../models/user/user.schema';
import { WalletSchemaClass, WalletDocument } from '../models/wallet/wallet.schema';
import { CommunityId, UserId } from '../value-objects';
import { EventBus } from '../events/event-bus';
import { MongoArrayUpdateHelper } from '../common/helpers/mongo-array-update.helper';
import { uid } from 'uid';
import { UserService } from './user.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { CommunityDefaultsService } from './community-defaults.service';
import { GLOBAL_ROLE_SUPERADMIN, COMMUNITY_ROLE_LEAD } from '../common/constants/roles.constants';

export interface CreateCommunityDto {
  id?: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  typeTag?:
    | 'future-vision'
    | 'marathon-of-good'
    | 'support'
    | 'team'
    | 'political'
    | 'housing'
    | 'volunteer'
    | 'corporate'
    | 'custom';
  settings?: {
    iconUrl?: string;
    currencyNames?: {
      singular: string;
      plural: string;
      genitive: string;
    };
    dailyEmission?: number;
  };
  isPriority?: boolean;
}

export interface UpdateCommunityDto {
  name?: string;
  description?: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  hashtags?: string[];
  hashtagDescriptions?: Record<string, string>;
  settings?: {
    iconUrl?: string;
    currencyNames?: {
      singular: string;
      plural: string;
      genitive: string;
    };
    dailyEmission?: number;
  };
  isPriority?: boolean;
}

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    @InjectModel(CommunitySchemaClass.name)
    private communityModel: Model<CommunityDocument>,
    @InjectModel(UserSchemaClass.name) private userModel: Model<UserDocument>,
    @InjectModel(WalletSchemaClass.name) private walletModel: Model<WalletDocument>,
    @InjectConnection() private mongoose: Connection,
    private eventBus: EventBus,
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    @Inject(forwardRef(() => UserCommunityRoleService))
    private userCommunityRoleService: UserCommunityRoleService,
    private communityDefaultsService: CommunityDefaultsService,
  ) {}

  async getCommunity(communityId: string): Promise<Community | null> {
    // Query by internal ID only
    const doc = await this.communityModel.findOne({ id: communityId }).lean();
    return doc ? (doc as unknown as Community) : null;
  }


  /**
   * Get effective permission rules (defaults merged with custom overrides)
   * DB rules override defaults. Rules are matched by role + action.
   */
  getEffectivePermissionRules(community: Community): PermissionRule[] {
    const defaultRules = this.communityDefaultsService.getDefaultPermissionRules(
      community.typeTag,
    );

    if (!community.permissionRules || community.permissionRules.length === 0) {
      return defaultRules;
    }

    // Merge: DB rules override defaults
    // Create a map of default rules by role+action for quick lookup
    const defaultRulesMap = new Map<string, PermissionRule>();
    for (const rule of defaultRules) {
      const key = `${rule.role}:${rule.action}`;
      defaultRulesMap.set(key, rule);
    }

    // Create a map of DB rules by role+action
    const dbRulesMap = new Map<string, PermissionRule>();
    for (const rule of community.permissionRules) {
      const key = `${rule.role}:${rule.action}`;
      dbRulesMap.set(key, rule);
    }

    // Merge: DB rules override defaults, but include all default rules
    const mergedRules: PermissionRule[] = [];
    const processedKeys = new Set<string>();

    // First, add all DB rules (these override defaults)
    for (const dbRule of community.permissionRules) {
      const key = `${dbRule.role}:${dbRule.action}`;
      mergedRules.push(dbRule);
      processedKeys.add(key);
    }

    // Then, add default rules that weren't overridden
    for (const defaultRule of defaultRules) {
      const key = `${defaultRule.role}:${defaultRule.action}`;
      if (!processedKeys.has(key)) {
        mergedRules.push(defaultRule);
      }
    }

    return mergedRules;
  }

  /**
   * Get effective merit settings (defaults merged with custom overrides)
   */
  getEffectiveMeritSettings(community: Community): CommunityMeritSettings {
    const defaults = this.communityDefaultsService.getDefaultMeritSettings(
      community.typeTag,
    );

    if (!community.meritSettings) {
      return defaults;
    }

    return {
      ...defaults,
      ...community.meritSettings,
      quotaRecipients:
        community.meritSettings.quotaRecipients ?? defaults.quotaRecipients,
    };
  }

  /**
   * Get effective voting settings (defaults merged with custom overrides)
   */
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
      meritConversion:
        community.votingSettings.meritConversion ?? defaults.meritConversion,
    };
  }

  async getCommunityByTypeTag(typeTag: string): Promise<Community | null> {
    const doc = await this.communityModel.findOne({ typeTag }).lean();
    return doc ? (doc as unknown as Community) : null;
  }

  async onModuleInit() {
    await this.ensureBaseCommunities();
  }

  private async ensureBaseCommunities() {
    this.logger.log('Checking base communities...');

    // 1. Future Vision
    const futureVision = await this.getCommunityByTypeTag('future-vision');
    if (!futureVision) {
      this.logger.log('Creating "Future Vision" community...');
      try {
        await this.createCommunity({
          name: 'Образ Будущего',
          description: 'Группа для публикации и обсуждения образов будущего.',
          typeTag: 'future-vision',
          isPriority: true,
          settings: {
            currencyNames: {
              singular: 'merit',
              plural: 'merits',
              genitive: 'merits',
            },
            dailyEmission: 10,
          },
        });
      } catch (e) {
        this.logger.error('Failed to create Future Vision', e);
      }
    } else if (!futureVision.isPriority) {
      // Update existing community to ensure it's marked as priority
      this.logger.log('Updating "Future Vision" community to set isPriority=true...');
      await this.updateCommunity(futureVision.id, { isPriority: true });
    }

    // 2. Marathon of Good
    const marathon = await this.getCommunityByTypeTag('marathon-of-good');
    if (!marathon) {
      this.logger.log('Creating "Marathon of Good" community...');
      try {
        await this.createCommunity({
          name: 'Марафон Добра',
          description: 'Группа для отчетов о добрых делах.',
          typeTag: 'marathon-of-good',
          isPriority: true,
          settings: {
            currencyNames: {
              singular: 'merit',
              plural: 'merits',
              genitive: 'merits',
            },
            dailyEmission: 10,
          },
        });
      } catch (e) {
        this.logger.error('Failed to create Marathon of Good', e);
      }
    } else if (!marathon.isPriority) {
      // Update existing community to ensure it's marked as priority
      this.logger.log('Updating "Marathon of Good" community to set isPriority=true...');
      await this.updateCommunity(marathon.id, { isPriority: true });
    }

    // 3. Support
    const support = await this.getCommunityByTypeTag('support');
    if (!support) {
      this.logger.log('Creating "Support" community...');
      try {
        await this.createCommunity({
          name: 'Поддержка',
          description: 'Группа поддержки.',
          typeTag: 'support',
          isPriority: true,
          settings: {
            currencyNames: {
              singular: 'merit',
              plural: 'merits',
              genitive: 'merits',
            },
            dailyEmission: 10,
          },
        });
      } catch (e) {
        this.logger.error('Failed to create Support', e);
      }
    } else if (!support.isPriority) {
      // Update existing community to ensure it's marked as priority
      this.logger.log('Updating "Support" community to set isPriority=true...');
      await this.updateCommunity(support.id, { isPriority: true });
    }
  }

  async createCommunity(dto: CreateCommunityDto): Promise<Community> {
    // Check for single-instance communities (Future Vision, Good Deeds Marathon, and Support)
    if (dto.typeTag === 'future-vision' || dto.typeTag === 'marathon-of-good' || dto.typeTag === 'support') {
      const existing = await this.communityModel
        .findOne({ typeTag: dto.typeTag })
        .lean();
      if (existing) {
        throw new BadRequestException(
          `Community with typeTag "${dto.typeTag}" already exists. Only one instance is allowed.`,
        );
      }
    }

    // Defaults are now provided by CommunityDefaultsService at runtime
    // Only store custom overrides if provided in DTO (not implemented yet - always undefined for now)
    const community = {
      id: dto.id || uid(),
      name: dto.name,
      description: dto.description,
      avatarUrl: dto.avatarUrl,
      typeTag: dto.typeTag,
      members: [],
      settings: {
        iconUrl: dto.settings?.iconUrl,
        currencyNames: dto.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        dailyEmission: dto.settings?.dailyEmission || 10,
      },
      // Don't store default permission rules - they come from code via CommunityDefaultsService
      // Default meritSettings and votingSettings are also provided by CommunityDefaultsService
      hashtags: [],
      hashtagDescriptions: {},
      isActive: true, // Default to active
      isPriority: dto.isPriority || false, // Default to false
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.communityModel.create([community]);
    this.logger.log(
      `Community created: ${community.id}${dto.typeTag ? ` (typeTag: ${dto.typeTag})` : ''}`,
    );
    return community;
  }

  async updateCommunity(
    communityId: string,
    dto: UpdateCommunityDto,
  ): Promise<Community> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;
    if (dto.coverImageUrl !== undefined) updateData.coverImageUrl = dto.coverImageUrl;
    if (dto.hashtags !== undefined) updateData.hashtags = dto.hashtags;
    if (dto.hashtagDescriptions !== undefined) {
      updateData.hashtagDescriptions = dto.hashtagDescriptions;
    }
    if (dto.isPriority !== undefined) updateData.isPriority = dto.isPriority;

    if (dto.settings) {
      // Only merge nested properties if they exist
      const settingsUpdate: any = {};
      if (dto.settings.iconUrl !== undefined)
        settingsUpdate['settings.iconUrl'] = dto.settings.iconUrl;
      if (dto.settings.currencyNames !== undefined) {
        if (dto.settings.currencyNames.singular !== undefined) {
          settingsUpdate['settings.currencyNames.singular'] =
            dto.settings.currencyNames.singular;
        }
        if (dto.settings.currencyNames.plural !== undefined) {
          settingsUpdate['settings.currencyNames.plural'] =
            dto.settings.currencyNames.plural;
        }
        if (dto.settings.currencyNames.genitive !== undefined) {
          settingsUpdate['settings.currencyNames.genitive'] =
            dto.settings.currencyNames.genitive;
        }
      }
      if (dto.settings.dailyEmission !== undefined) {
        settingsUpdate['settings.dailyEmission'] = dto.settings.dailyEmission;
      }

      // Merge settings into updateData
      Object.assign(updateData, settingsUpdate);
    }

    const updatedCommunity = await this.communityModel
      .findOneAndUpdate(
        { id: communityId },
        { $set: updateData },
        { new: true },
      )
      .lean();

    if (!updatedCommunity) {
      throw new NotFoundException('Community not found');
    }

    return (updatedCommunity as unknown) as Community;
  }

  async deleteCommunity(communityId: string): Promise<void> {
    const result = await this.communityModel.deleteOne({ id: communityId });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Community not found');
    }
  }

  async addMember(communityId: string, userId: string): Promise<Community> {
    return MongoArrayUpdateHelper.addToArray<Community>(
      this.communityModel,
      { id: communityId },
      'members',
      userId,
      'Community',
    );
  }

  async removeMember(communityId: string, userId: string): Promise<Community> {
    return MongoArrayUpdateHelper.removeFromArray<Community>(
      this.communityModel,
      { id: communityId },
      'members',
      userId,
      'Community',
    );
  }

  async isUserAdmin(communityId: string, userId: string): Promise<boolean> {
    // 1. Check global superadmin role
    const user = await this.userService.getUserById(userId);
    if (user?.globalRole === GLOBAL_ROLE_SUPERADMIN) {
      return true;
    }

    // 2. Check lead role in community
    const userRole = await this.userCommunityRoleService.getRole(userId, communityId);
    if (userRole?.role === COMMUNITY_ROLE_LEAD) {
      return true;
    }

    return false;
  }

  async isUserMember(communityId: string, userId: string): Promise<boolean> {
    const community = await this.communityModel
      .findOne({
        id: communityId,
        members: userId,
      })
      .lean();
    return community !== null;
  }

  async getAllCommunities(
    limit: number = 50,
    skip: number = 0,
  ): Promise<Community[]> {
    return this.communityModel
      .find({})
      .limit(limit)
      .skip(skip)
      .sort({ isPriority: -1, createdAt: -1 }) // Приоритетные сообщества сначала, затем по дате создания
      .lean() as unknown as Community[];
  }

  async getUserCommunities(userId: string): Promise<Community[]> {
    return this.communityModel
      .find({ members: userId })
      .sort({ isPriority: -1, createdAt: -1 }) // Приоритетные сообщества сначала, затем по дате создания
      .lean() as unknown as Community[];
  }

  async getUserManagedCommunities(userId: string): Promise<Community[]> {
    // Get all community IDs where user has 'lead' role
    const communityIds = await this.userCommunityRoleService.getCommunitiesByRole(
      userId,
      'lead',
    );

    if (communityIds.length === 0) {
      return [];
    }

    // Fetch communities by IDs
    return this.communityModel
      .find({ id: { $in: communityIds } })
      .sort({ createdAt: -1 })
      .lean() as unknown as Community[];
  }

  async addHashtag(communityId: string, hashtag: string): Promise<Community> {
    return MongoArrayUpdateHelper.addToArray<Community>(
      this.communityModel,
      { id: communityId },
      'hashtags',
      hashtag,
      'Community',
    );
  }

  async removeHashtag(
    communityId: string,
    hashtag: string,
  ): Promise<Community> {
    return MongoArrayUpdateHelper.removeFromArray<Community>(
      this.communityModel,
      { id: communityId },
      'hashtags',
      hashtag,
      'Community',
    );
  }

  async updateUserChatMembership(
    chatId: string,
    userId: string,
  ): Promise<boolean> {
    // This is a placeholder for Telegram Bot API integration
    // In a real implementation, this would:
    // 1. Call Telegram Bot API to check if the user is a member of the chat
    // 2. Update the user's community memberships in the database based on the result
    // For now, we'll assume the user is a member
    this.logger.log(`Checking membership: user ${userId} in chat ${chatId}`);
    return true;
  }

  async resetDailyQuota(communityId: string): Promise<{ resetAt: Date }> {
    this.logger.log(`Resetting daily quota for community ${communityId}`);

    // Update lastQuotaResetAt timestamp to current time
    const resetAt = new Date();
    const updatedCommunity = await this.communityModel
      .findOneAndUpdate(
        { id: communityId },
        {
          $set: {
            lastQuotaResetAt: resetAt,
            updatedAt: new Date(),
          },
        },
        { new: true },
      )
      .lean();

    if (!updatedCommunity) {
      throw new NotFoundException('Community not found');
    }

    this.logger.log(
      `Quota reset timestamp updated for community ${communityId} at ${resetAt.toISOString()}`,
    );
    return { resetAt };
  }

  async getCommunityMembers(
    communityId: string,
    limit: number = 50,
    skip: number = 0,
  ): Promise<{ members: any[]; total: number }> {
    // 1. Get community to retrieve memberIds, settings, and total count
    const community = await this.communityModel
      .findOne({ id: communityId })
      .lean();
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const memberIds = community.members || [];
    const total = memberIds.length;
    const paginatedIds = memberIds.slice(skip, skip + limit);

    if (paginatedIds.length === 0) {
      return { members: [], total };
    }

    // Calculate quota start time (needed for quota aggregation)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const quotaStartTime = community.lastQuotaResetAt
      ? new Date(community.lastQuotaResetAt)
      : today;
    
    const dailyQuota = community.settings?.dailyEmission ?? 0;
    const isFutureVision = community.typeTag === 'future-vision';
    const isMarathonOfGood = community.typeTag === 'marathon-of-good';

    // 2. Use aggregation pipeline to join users with roles, wallets, and quota
    const members = await this.userModel.aggregate([
      // Match only the paginated user IDs
      { $match: { id: { $in: paginatedIds } } },
      
      // Lookup user community role for this specific community
      {
        $lookup: {
          from: 'user_community_roles',
          let: { userId: '$id', communityId: communityId },
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
      
      // Lookup wallet for this user in this community
      {
        $lookup: {
          from: 'wallets',
          let: { userId: '$id', communityId: communityId },
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

      // Add community context for quota calculation
      {
        $addFields: {
          userRole: { $arrayElemAt: ['$roleData.role', 0] },
          dailyQuota: dailyQuota,
          quotaStartTime: quotaStartTime,
          isFutureVision: isFutureVision,
          isMarathonOfGood: isMarathonOfGood,
        },
      },

      // Lookup and aggregate quota usage from votes
      {
        $lookup: {
          from: 'votes',
          let: { userId: '$id', communityId: communityId, quotaStartTime: quotaStartTime },
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
          as: 'votesQuota',
        },
      },

      // Lookup and aggregate quota usage from poll_casts
      {
        $lookup: {
          from: 'poll_casts',
          let: { userId: '$id', communityId: communityId, quotaStartTime: quotaStartTime },
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
          as: 'pollCastsQuota',
        },
      },

      // Lookup and aggregate quota usage from quota_usage
      {
        $lookup: {
          from: 'quota_usage',
          let: { userId: '$id', communityId: communityId, quotaStartTime: quotaStartTime },
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
          as: 'quotaUsageQuota',
        },
      },

      // Calculate quota fields
      {
        $addFields: {
          votesTotal: { $ifNull: [{ $arrayElemAt: ['$votesQuota.total', 0] }, 0] },
          pollCastsTotal: { $ifNull: [{ $arrayElemAt: ['$pollCastsQuota.total', 0] }, 0] },
          quotaUsageTotal: { $ifNull: [{ $arrayElemAt: ['$quotaUsageQuota.total', 0] }, 0] },
        },
      },

      {
        $addFields: {
          usedToday: {
            $add: ['$votesTotal', '$pollCastsTotal', '$quotaUsageTotal'],
          },
          // Calculate effective daily quota based on role and community type
          effectiveDailyQuota: {
            $cond: {
              if: {
                $or: [
                  { $eq: ['$isFutureVision', true] },
                  {
                    $and: [
                      { $eq: ['$userRole', 'viewer'] },
                      { $ne: ['$isMarathonOfGood', true] },
                    ],
                  },
                ],
              },
              then: 0,
              else: '$dailyQuota',
            },
          },
        },
      },

      {
        $addFields: {
          remainingToday: {
            $max: [
              0,
              {
                $subtract: ['$effectiveDailyQuota', '$usedToday'],
              },
            ],
          },
        },
      },

      // Project final structure
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
            dailyQuota: '$effectiveDailyQuota',
            usedToday: '$usedToday',
            remainingToday: '$remainingToday',
          },
        },
      },
    ]);

    // 3. Map to DTO format (handle undefined/null values)
    const mappedMembers = members.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      globalRole: user.globalRole,
      role: user.role || undefined,
      walletBalance: user.walletBalance ?? undefined,
      quota: user.quota
        ? {
            dailyQuota: user.quota.dailyQuota ?? 0,
            usedToday: user.quota.usedToday ?? 0,
            remainingToday: user.quota.remainingToday ?? 0,
          }
        : undefined,
    }));

    return { members: mappedMembers, total };
  }
}
