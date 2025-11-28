import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { User, UserDocument } from '../models/user/user.schema';
import { UserId } from '../value-objects';
import { EventBus } from '../events/event-bus';
import { MongoArrayUpdateHelper } from '../common/helpers/mongo-array-update.helper';
import { uid } from 'uid';

export interface CreateUserDto {
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  website?: string;
  isVerified?: boolean;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectConnection() private mongoose: Connection,
    private eventBus: EventBus,
  ) {}

  async getUser(userId: string): Promise<User | null> {
    // Search by internal id field
    const doc = await this.userModel.findOne({ id: userId }).lean();
    return doc;
  }

  async getUserById(id: string): Promise<User | null> {
    // Search by internal id field
    const doc = await this.userModel.findOne({ id }).lean();
    return doc;
  }

  async getUserByTelegramId(telegramId: string): Promise<User | null> {
    // Search by telegramId field
    const doc = await this.userModel.findOne({ telegramId }).lean();
    return doc;
  }

  async getUserByToken(token: string): Promise<User | null> {
    const doc = await this.userModel.findOne({ token }).lean();
    return doc;
  }

  async createOrUpdateUser(dto: CreateUserDto, token?: string): Promise<User> {
    // Check if user exists
    let user = await this.userModel.findOne({ telegramId: dto.telegramId }).lean();
    
    if (user) {
      // Update existing user
      // Note: $set preserves fields not in updateData (e.g., communityTags, communityMemberships)
      const updateData: any = {
        username: dto.username,
        firstName: dto.firstName,
        lastName: dto.lastName,
        displayName: dto.displayName || `${dto.firstName || ''} ${dto.lastName || ''}`.trim(),
        avatarUrl: dto.avatarUrl,
        updatedAt: new Date(),
      };

      if (token) {
        updateData.token = token;
      }

      // Update profile fields if provided (using dot notation for nested fields)
      if (dto.bio !== undefined || dto.location !== undefined || dto.website !== undefined || dto.isVerified !== undefined) {
        if (dto.bio !== undefined) updateData['profile.bio'] = dto.bio;
        if (dto.location !== undefined) updateData['profile.location'] = dto.location;
        if (dto.website !== undefined) updateData['profile.website'] = dto.website;
        if (dto.isVerified !== undefined) updateData['profile.isVerified'] = dto.isVerified;
      }

      await this.userModel.updateOne(
        { telegramId: dto.telegramId },
        { $set: updateData }
      );
      // Re-fetch user to get updated data including preserved communityTags and communityMemberships
      user = await this.userModel.findOne({ telegramId: dto.telegramId }).lean();
    } else {
      // Create new user
      const newUser = {
        id: uid(),
        telegramId: dto.telegramId,
        username: dto.username,
        firstName: dto.firstName,
        lastName: dto.lastName,
        displayName: dto.displayName || `${dto.firstName || ''} ${dto.lastName || ''}`.trim(),
        avatarUrl: dto.avatarUrl,
        profile: {
          bio: dto.bio,
          location: dto.location,
          website: dto.website,
          isVerified: dto.isVerified || false,
        },
        communityTags: [],
        token: token || uid(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.userModel.create([newUser]);
      user = await this.userModel.findOne({ id: newUser.id }).lean();
    }

    return user;
  }

  async addCommunityMembership(userId: string, communityId: string): Promise<User> {
    return MongoArrayUpdateHelper.addToArray<User>(
      this.userModel,
      { telegramId: userId },
      'communityMemberships',
      communityId,
      'User'
    );
  }

  async removeCommunityMembership(userId: string, communityId: string): Promise<User> {
    return MongoArrayUpdateHelper.removeFromArray<User>(
      this.userModel,
      { telegramId: userId },
      'communityMemberships',
      communityId,
      'User'
    );
  }

  async getUserCommunities(userId: string): Promise<string[]> {
    const user = await this.userModel.findOne({ telegramId: userId }).lean();
    return user?.communityMemberships || [];
  }

  async isUserMemberOfCommunity(userId: string, communityId: string): Promise<boolean> {
    const user = await this.userModel.findOne({ 
      telegramId: userId,
      communityMemberships: communityId 
    }).lean();
    return user !== null;
  }

  async getAllUsers(limit: number = 50, skip: number = 0): Promise<User[]> {
    return this.userModel
      .find({})
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean();
  }

  async getUsersByCommunity(communityId: string, limit: number = 50, skip: number = 0): Promise<User[]> {
    return this.userModel
      .find({ communityMemberships: communityId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean();
  }
}
