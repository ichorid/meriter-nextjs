import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import {
  Community,
  CommunityDocument,
} from '../models/community/community.schema';
import { User, UserDocument } from '../models/user/user.schema';
import { CommunityId, UserId } from '../value-objects';
import { EventBus } from '../events/event-bus';
import { MongoArrayUpdateHelper } from '../common/helpers/mongo-array-update.helper';
import { uid } from 'uid';

export interface CreateCommunityDto {
  name: string;
  description?: string;
  avatarUrl?: string;
  typeTag?:
    | 'future-vision'
    | 'marathon-of-good'
    | 'team'
    | 'political'
    | 'housing'
    | 'volunteer'
    | 'corporate'
    | 'custom';
  // Internal User IDs
  adminIds: string[];
  settings?: {
    iconUrl?: string;
    currencyNames?: {
      singular: string;
      plural: string;
      genitive: string;
    };
    dailyEmission?: number;
  };
}

export interface UpdateCommunityDto {
  name?: string;
  description?: string;
  avatarUrl?: string;
  // Internal User IDs
  adminIds?: string[];
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
    @InjectModel(Community.name)
    private communityModel: Model<CommunityDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectConnection() private mongoose: Connection,
    private eventBus: EventBus,
  ) {}

  async getCommunity(communityId: string): Promise<Community | null> {
    // Query by internal ID only
    const doc = await this.communityModel.findOne({ id: communityId }).lean();
    return doc as any as Community;
  }

  async getCommunityByTypeTag(typeTag: string): Promise<Community | null> {
    const doc = await this.communityModel.findOne({ typeTag }).lean();
    return doc as any as Community;
  }

  async onModuleInit() {
    await this.ensureBaseCommunities();
  }

  private async ensureBaseCommunities() {
    this.logger.log('Checking base communities...');

    // Try to find a superadmin to assign as admin
    const superadmin = await this.userModel
      .findOne({ globalRole: 'superadmin' })
      .lean();
    const adminIds = superadmin ? [superadmin.id] : [];

    // 1. Future Vision
    const futureVision = await this.getCommunityByTypeTag('future-vision');
    if (!futureVision) {
      this.logger.log('Creating "Future Vision" community...');
      try {
        await this.createCommunity({
          name: 'Образ Будущего',
          description: 'Группа для публикации и обсуждения образов будущего.',
          typeTag: 'future-vision',
          adminIds,
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
          adminIds,
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
    }
  }

  async createCommunity(dto: CreateCommunityDto): Promise<Community> {
    // Check for single-instance communities (Future Vision and Good Deeds Marathon)
    if (dto.typeTag === 'future-vision' || dto.typeTag === 'marathon-of-good') {
      const existing = await this.communityModel
        .findOne({ typeTag: dto.typeTag })
        .lean();
      if (existing) {
        throw new BadRequestException(
          `Community with typeTag "${dto.typeTag}" already exists. Only one instance is allowed.`,
        );
      }
    }

    // Set default voting rules based on community type
    const defaultVotingRules = {
      allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'] as (
        | 'superadmin'
        | 'lead'
        | 'participant'
        | 'viewer'
      )[],
      canVoteForOwnPosts: false, // Default: cannot vote for own posts
      participantsCannotVoteForLead: false,
      spendsMerits: true,
      awardsMerits: true,
    };

    // Set default posting rules
    const defaultPostingRules = {
      allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'] as (
        | 'superadmin'
        | 'lead'
        | 'participant'
        | 'viewer'
      )[],
      requiresTeamMembership: false,
      onlyTeamLead: false,
      autoMembership: false,
    };

    // Special rules for "Marathon of Good"
    if (dto.typeTag === 'marathon-of-good') {
      // Voting: Members cannot vote for Representative posts
      defaultVotingRules.participantsCannotVoteForLead = true;
      // Posting: Only Representatives (leads) can post
      defaultPostingRules.allowedRoles = ['superadmin', 'lead'];
      defaultPostingRules.onlyTeamLead = true;
    }

    // Special rules for "Future Vision"
    if (dto.typeTag === 'future-vision') {
      // Voting: Representatives CAN vote for own posts (exception)
      defaultVotingRules.canVoteForOwnPosts = true;
      // Posting: Only Representatives (leads) can post
      defaultPostingRules.allowedRoles = ['superadmin', 'lead'];
      defaultPostingRules.onlyTeamLead = true;
    }

    // Special rules for "Team"
    if (dto.typeTag === 'team') {
      // Posting: Only Team Members and Lead
      defaultPostingRules.allowedRoles = ['superadmin', 'lead', 'participant'];
      defaultPostingRules.requiresTeamMembership = true;
      // Voting: Team Members can vote
      defaultVotingRules.allowedRoles = ['superadmin', 'lead', 'participant'];
    }

    const community = {
      id: uid(),
      name: dto.name,
      description: dto.description,
      avatarUrl: dto.avatarUrl,
      typeTag: dto.typeTag,
      adminIds: dto.adminIds,
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
      postingRules: defaultPostingRules,
      votingRules: defaultVotingRules,
      visibilityRules: {
        visibleToRoles: ['superadmin', 'lead', 'participant', 'viewer'] as (
          | 'superadmin'
          | 'lead'
          | 'participant'
          | 'viewer'
        )[],
        isHidden: false,
        teamOnly: false,
      },
      meritRules: {
        dailyQuota: 100,
        quotaRecipients: ['superadmin', 'lead', 'participant', 'viewer'] as (
          | 'superadmin'
          | 'lead'
          | 'participant'
          | 'viewer'
        )[],
        canEarn: true,
        canSpend: true,
      },
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
    if (dto.adminIds !== undefined) updateData.adminIds = dto.adminIds;
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

    return updatedCommunity as any as Community;
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
    const community = await this.communityModel
      .findOne({
        id: communityId,
        adminIds: userId,
      })
      .lean();
    return community !== null;
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
      .lean() as any as Community[];
  }

  async getUserCommunities(userId: string): Promise<Community[]> {
    return this.communityModel
      .find({ members: userId })
      .sort({ isPriority: -1, createdAt: -1 }) // Приоритетные сообщества сначала, затем по дате создания
      .lean() as any as Community[];
  }

  async getUserManagedCommunities(userId: string): Promise<Community[]> {
    return this.communityModel
      .find({ adminIds: userId })
      .sort({ createdAt: -1 })
      .lean() as any as Community[];
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
    const community = await this.communityModel
      .findOne({ id: communityId })
      .lean();
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const memberIds = community.members || [];
    const total = memberIds.length;

    // Reverse to show newest members first (assuming appended to end)
    // or just slice. Let's slice for now, but usually we want recent.
    // Arrays in Mongo are usually appended.
    const paginatedIds = memberIds.slice(skip, skip + limit);

    if (paginatedIds.length === 0) {
      return { members: [], total };
    }

    const members = await this.userModel
      .find({
        id: { $in: paginatedIds },
      })
      .lean();

    // Map to DTOs
    const mappedMembers = members.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      globalRole: user.globalRole,
      // We might want to fetch community-specific role here too, but that's expensive
      // for a list. PermissionService has getUserRoleInCommunity.
    }));

    return { members: mappedMembers, total };
  }
}
