import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import { Community, CommunityDocument } from '../domain/models/community/community.schema';
import { User, UserDocument } from '../domain/models/user/user.schema';

export interface TelegramChatInfo {
  chatId: string;
  chatUsername?: string;
  title?: string;
  description?: string;
  avatarUrl?: string;
}

export interface TelegramUserInfo {
  userId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  avatarUrl?: string;
}

@Injectable()
export class TelegramBotLifecycleService {
  private readonly logger = new Logger(TelegramBotLifecycleService.name);

  constructor(
    @InjectModel(Community.name) private communityModel: Model<CommunityDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) { }

  async handleBotAddedToChat(chatInfo: TelegramChatInfo): Promise<void> {
    this.logger.log(`Bot added to chat: ${chatInfo.chatId}`);

    // Check if community already exists
    const existingCommunity = null;
    if (existingCommunity) {
      this.logger.log(`Community already exists for chat ${chatInfo.chatId}, reactivating`);
      await this.communityModel.updateOne(
        { _id: existingCommunity._id },
        {
          $set: {
            isActive: true,
            updatedAt: new Date(),
          }
        }
      );
      return;
    }

    // Create new community
    const community = await this.communityModel.create({

      name: chatInfo.title || `Chat ${chatInfo.chatId}`,
      description: chatInfo.description,
      members: [],
      settings: {
        currencyNames: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        dailyEmission: 100,
        language: 'en',
      },
      hashtags: [],
      isAdmin: false,
      needsSetup: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.logger.log(`Community created: ${community.id} for chat ${chatInfo.chatId}`);
  }

  async handleBotRemovedFromChat(chatId: string): Promise<void> {
    this.logger.log(`Bot removed from chat: ${chatId}`);

    const community = null;
    if (!community) {
      this.logger.warn(`Community not found for chat ${chatId}`);
      return;
    }

    // Mark community as inactive
    await this.communityModel.updateOne(
      { _id: community._id },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
        }
      }
    );

    // Remove community tag from all users
    const users = await this.userModel.find({ communityTags: chatId }).lean();
    for (const user of users) {
      await this.userModel.updateOne(
        { _id: user._id },
        { $pull: { communityTags: chatId } }
      );
    }

    this.logger.log(`Community deactivated: ${community.id}`);
  }

  async handleUserJoinedChat(chatId: string, userInfo: TelegramUserInfo): Promise<void> {
    this.logger.log(`User joined chat: ${userInfo.userId} in ${chatId}`);

    // Find or create user
    let user = await this.userModel.findOne({ authProvider: 'telegram', authId: userInfo.userId }).lean();
    if (!user) {
      const newUser = await this.userModel.create({
        id: uid(),
        authProvider: 'telegram',
        authId: userInfo.userId,
        displayName: userInfo.displayName,
        username: userInfo.username,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        profile: {
          bio: undefined,
          location: undefined,
          website: undefined,
          isVerified: false,
        },
        communityTags: [],
        communityMemberships: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      // Convert to plain object to match lean() format
      user = newUser.toObject();
    }

    // Add community tag to user
    await this.userModel.updateOne(
      { _id: user._id },
      { $addToSet: { communityTags: chatId } }
    );

    // Add user to community members
    const community = null;
    if (community) {
      await this.communityModel.updateOne(
        { _id: community._id },
        { $addToSet: { members: user._id.toString() } }
      );
    }

    this.logger.log(`User ${user.id} added to community ${chatId}`);
  }

  async handleUserLeftChat(chatId: string, userId: string): Promise<void> {
    this.logger.log(`User left chat: ${userId} from ${chatId}`);

    const user = await this.userModel.findOne({ authProvider: 'telegram', authId: userId }).lean();
    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      return;
    }

    // Remove community tag from user
    await this.userModel.updateOne(
      { _id: user._id },
      { $pull: { communityTags: chatId } }
    );

    // Remove user from community members
    const community = null;
    if (community) {
      await this.communityModel.updateOne(
        { _id: community._id },
        { $pull: { members: user._id.toString() } }
      );
    }

    this.logger.log(`User ${user.id} removed from community ${chatId}`);
  }
}
