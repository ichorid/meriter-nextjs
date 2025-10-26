import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, ClientSession } from 'mongoose';
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
export class CommunityServiceV2 {
  private readonly logger = new Logger(CommunityServiceV2.name);

  constructor(
    @InjectModel(Community.name) private communityModel: Model<CommunityDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectConnection() private mongoose: Connection,
    private eventBus: EventBus,
  ) {}

  async getCommunity(communityId: string): Promise<Community | null> {
    // Direct Mongoose query
    const doc = await this.communityModel.findOne({ telegramChatId: communityId }).lean();
    return doc;
  }

  async createCommunity(dto: CreateCommunityDto): Promise<Community> {
    const session = await this.mongoose.startSession();
    session.startTransaction();

    try {
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
        spaces: [],
        isActive: true, // Default to active
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.communityModel.create([community], { session });
      await session.commitTransaction();

      this.logger.log(`Community created: ${community.id}`);
      return community;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async updateCommunity(communityId: string, dto: UpdateCommunityDto): Promise<Community> {
    const session = await this.mongoose.startSession();
    session.startTransaction();

    try {
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;
      if (dto.administrators !== undefined) updateData.administrators = dto.administrators;
      
      if (dto.settings) {
        updateData.settings = {
          ...updateData.settings,
          ...dto.settings,
        };
      }

      const updatedCommunity = await this.communityModel.findOneAndUpdate(
        { telegramChatId: communityId },
        { $set: updateData },
        { new: true, session }
      ).lean();

      if (!updatedCommunity) {
        throw new NotFoundException('Community not found');
      }

      await session.commitTransaction();
      return updatedCommunity;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async deleteCommunity(communityId: string): Promise<void> {
    const session = await this.mongoose.startSession();
    session.startTransaction();

    try {
      const result = await this.communityModel.deleteOne(
        { telegramChatId: communityId },
        { session }
      );

      if (result.deletedCount === 0) {
        throw new NotFoundException('Community not found');
      }

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async addMember(communityId: string, userId: string): Promise<Community> {
    const session = await this.mongoose.startSession();
    session.startTransaction();

    try {
      const updatedCommunity = await this.communityModel.findOneAndUpdate(
        { telegramChatId: communityId },
        { 
          $addToSet: { members: userId },
          $set: { updatedAt: new Date() }
        },
        { new: true, session }
      ).lean();

      if (!updatedCommunity) {
        throw new NotFoundException('Community not found');
      }

      await session.commitTransaction();
      return updatedCommunity;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async removeMember(communityId: string, userId: string): Promise<Community> {
    const session = await this.mongoose.startSession();
    session.startTransaction();

    try {
      const updatedCommunity = await this.communityModel.findOneAndUpdate(
        { telegramChatId: communityId },
        { 
          $pull: { members: userId },
          $set: { updatedAt: new Date() }
        },
        { new: true, session }
      ).lean();

      if (!updatedCommunity) {
        throw new NotFoundException('Community not found');
      }

      await session.commitTransaction();
      return updatedCommunity;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
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
      .lean();
  }

  async getUserCommunities(userId: string): Promise<Community[]> {
    return this.communityModel
      .find({ members: userId })
      .sort({ createdAt: -1 })
      .lean();
  }

  async getUserManagedCommunities(userId: string): Promise<Community[]> {
    return this.communityModel
      .find({ administrators: userId })
      .sort({ createdAt: -1 })
      .lean();
  }

  async addHashtag(communityId: string, hashtag: string): Promise<Community> {
    const session = await this.mongoose.startSession();
    session.startTransaction();

    try {
      const updatedCommunity = await this.communityModel.findOneAndUpdate(
        { telegramChatId: communityId },
        { 
          $addToSet: { hashtags: hashtag },
          $set: { updatedAt: new Date() }
        },
        { new: true, session }
      ).lean();

      if (!updatedCommunity) {
        throw new NotFoundException('Community not found');
      }

      await session.commitTransaction();
      return updatedCommunity;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async removeHashtag(communityId: string, hashtag: string): Promise<Community> {
    const session = await this.mongoose.startSession();
    session.startTransaction();

    try {
      const updatedCommunity = await this.communityModel.findOneAndUpdate(
        { telegramChatId: communityId },
        { 
          $pull: { hashtags: hashtag },
          $set: { updatedAt: new Date() }
        },
        { new: true, session }
      ).lean();

      if (!updatedCommunity) {
        throw new NotFoundException('Community not found');
      }

      await session.commitTransaction();
      return updatedCommunity;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
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
}
