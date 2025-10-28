import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { Community, CommunityDocument } from '../models/community/community.schema';
import { User, UserDocument } from '../models/user/user.schema';
import { CommunityId, UserId } from '../value-objects';
import { EventBus } from '../events/event-bus';
import { uid } from 'uid';

export interface CreateCommunityDto {
  telegramChatId: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  administrators: string[];
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
  administrators?: string[];
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
}

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    @InjectModel(Community.name) private communityModel: Model<CommunityDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectConnection() private mongoose: Connection,
    private eventBus: EventBus,
  ) {}

  async getCommunity(communityId: string): Promise<Community | null> {
    // Direct Mongoose query
    const doc = await this.communityModel.findOne({ telegramChatId: communityId }).lean();
    return doc as any as Community;
  }

  async createCommunity(dto: CreateCommunityDto): Promise<Community> {
    const community = {
      id: uid(),
      telegramChatId: dto.telegramChatId,
      name: dto.name,
      description: dto.description,
      avatarUrl: dto.avatarUrl,
      administrators: dto.administrators,
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
      hashtags: [],
      hashtagDescriptions: {},
      isActive: true, // Default to active
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.communityModel.create([community]);
    this.logger.log(`Community created: ${community.id}`);
    return community;
  }

  async updateCommunity(communityId: string, dto: UpdateCommunityDto): Promise<Community> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;
    if (dto.administrators !== undefined) updateData.administrators = dto.administrators;
    if (dto.hashtags !== undefined) updateData.hashtags = dto.hashtags;
    if (dto.hashtagDescriptions !== undefined) {
      updateData.hashtagDescriptions = dto.hashtagDescriptions;
    }
    
    if (dto.settings) {
      // Only merge nested properties if they exist
      const settingsUpdate: any = {};
      if (dto.settings.iconUrl !== undefined) settingsUpdate['settings.iconUrl'] = dto.settings.iconUrl;
      if (dto.settings.currencyNames !== undefined) {
        if (dto.settings.currencyNames.singular !== undefined) {
          settingsUpdate['settings.currencyNames.singular'] = dto.settings.currencyNames.singular;
        }
        if (dto.settings.currencyNames.plural !== undefined) {
          settingsUpdate['settings.currencyNames.plural'] = dto.settings.currencyNames.plural;
        }
        if (dto.settings.currencyNames.genitive !== undefined) {
          settingsUpdate['settings.currencyNames.genitive'] = dto.settings.currencyNames.genitive;
        }
      }
      if (dto.settings.dailyEmission !== undefined) {
        settingsUpdate['settings.dailyEmission'] = dto.settings.dailyEmission;
      }
      
      // Merge settings into updateData
      Object.assign(updateData, settingsUpdate);
    }

    const updatedCommunity = await this.communityModel.findOneAndUpdate(
      { telegramChatId: communityId },
      { $set: updateData },
      { new: true }
    ).lean();

    if (!updatedCommunity) {
      throw new NotFoundException('Community not found');
    }

    return updatedCommunity as any as Community;
  }

  async deleteCommunity(communityId: string): Promise<void> {
    const result = await this.communityModel.deleteOne(
      { telegramChatId: communityId }
    );

    if (result.deletedCount === 0) {
      throw new NotFoundException('Community not found');
    }
  }

  async addMember(communityId: string, userId: string): Promise<Community> {
    const updatedCommunity = await this.communityModel.findOneAndUpdate(
      { telegramChatId: communityId },
      { 
        $addToSet: { members: userId },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    ).lean();

    if (!updatedCommunity) {
      throw new NotFoundException('Community not found');
    }

    return updatedCommunity as any as Community;
  }

  async removeMember(communityId: string, userId: string): Promise<Community> {
    const updatedCommunity = await this.communityModel.findOneAndUpdate(
      { telegramChatId: communityId },
      { 
        $pull: { members: userId },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    ).lean();

    if (!updatedCommunity) {
      throw new NotFoundException('Community not found');
    }

    return updatedCommunity as any as Community;
  }

  async isUserAdmin(communityId: string, userId: string): Promise<boolean> {
    const community = await this.communityModel.findOne({ 
      telegramChatId: communityId,
      administrators: userId 
    }).lean();
    return community !== null;
  }

  async isUserMember(communityId: string, userId: string): Promise<boolean> {
    const community = await this.communityModel.findOne({ 
      telegramChatId: communityId,
      members: userId 
    }).lean();
    return community !== null;
  }

  async getAllCommunities(limit: number = 50, skip: number = 0): Promise<Community[]> {
    return this.communityModel
      .find({})
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean() as any as Community[];
  }

  async getUserCommunities(userId: string): Promise<Community[]> {
    return this.communityModel
      .find({ members: userId })
      .sort({ createdAt: -1 })
      .lean() as any as Community[];
  }

  async getUserManagedCommunities(userId: string): Promise<Community[]> {
    return this.communityModel
      .find({ administrators: userId })
      .sort({ createdAt: -1 })
      .lean() as any as Community[];
  }

  async addHashtag(communityId: string, hashtag: string): Promise<Community> {
    const updatedCommunity = await this.communityModel.findOneAndUpdate(
      { telegramChatId: communityId },
      { 
        $addToSet: { hashtags: hashtag },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    ).lean();

    if (!updatedCommunity) {
      throw new NotFoundException('Community not found');
    }

    return updatedCommunity as any as Community;
  }

  async removeHashtag(communityId: string, hashtag: string): Promise<Community> {
    const updatedCommunity = await this.communityModel.findOneAndUpdate(
      { telegramChatId: communityId },
      { 
        $pull: { hashtags: hashtag },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    ).lean();

    if (!updatedCommunity) {
      throw new NotFoundException('Community not found');
    }

    return updatedCommunity as any as Community;
  }

  async updateUserChatMembership(chatId: string, userId: string): Promise<boolean> {
    // This is a placeholder for Telegram Bot API integration
    // In a real implementation, this would:
    // 1. Call Telegram Bot API to check if the user is a member of the chat
    // 2. Update the user's community memberships in the database based on the result
    // For now, we'll assume the user is a member
    this.logger.log(`Checking membership: user ${userId} in chat ${chatId}`);
    return true;
  }

  async resetDailyQuota(communityId: string): Promise<number> {
    this.logger.log(`Resetting daily quota for community ${communityId}`);

    // Calculate today's date range (00:00:00 to 23:59:59)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Delete all votes with sourceType='quota' for this community today
    // Note: The schema uses 'quota' but some old data might have 'daily_quota'
    const result = await this.mongoose.db
      .collection('votes')
      .deleteMany({
        communityId,
        sourceType: { $in: ['quota', 'daily_quota'] },
        createdAt: { $gte: today, $lt: tomorrow }
      });

    this.logger.log(`Deleted ${result.deletedCount} quota votes for community ${communityId}`);
    return result.deletedCount;
  }
}
