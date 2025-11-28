import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { User, UserDocument } from '../models/user/user.schema';
import { Community, CommunityDocument } from '../models/community/community.schema';
import { UserId } from '../value-objects';
import { EventBus } from '../events/event-bus';
import { MongoArrayUpdateHelper } from '../common/helpers/mongo-array-update.helper';
import { uid } from 'uid';

export interface CreateUserDto {
  authProvider: string;
  authId: string;
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
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Community.name) private communityModel: Model<CommunityDocument>, // Modified constructor
  ) { }

  async onModuleInit() {
    try {
      // Drop legacy index on telegramId if it exists
      if (await this.userModel.collection.indexExists('telegramId_1')) {
        this.logger.log('Dropping legacy index: telegramId_1');
        await this.userModel.collection.dropIndex('telegramId_1');
        this.logger.log('Legacy index dropped successfully');
      }
    } catch (error) {
      // Ignore error if index doesn't exist (though indexExists check should prevent this)
      // or if other error occurs, just log it
      if (error.code !== 27) { // 27 is IndexNotFound
        this.logger.warn(`Failed to drop legacy index: ${error.message}`);
      }
    }
  }

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

  async getUserByAuthId(authProvider: string, authId: string): Promise<User | null> {
    // Search by authProvider and authId
    const doc = await this.userModel.findOne({ authProvider, authId }).lean();
    return doc;
  }

  async getUserByToken(token: string): Promise<User | null> {
    const doc = await this.userModel.findOne({ token }).lean();
    return doc;
  }

  async createOrUpdateUser(dto: CreateUserDto, token?: string): Promise<User> {
    // Check if user exists
    let user = await this.userModel.findOne({
      authProvider: dto.authProvider,
      authId: dto.authId
    }).lean();

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
        { authProvider: dto.authProvider, authId: dto.authId },
        { $set: updateData }
      );
      // Re-fetch user to get updated data including preserved communityTags and communityMemberships
      user = await this.userModel.findOne({
        authProvider: dto.authProvider,
        authId: dto.authId
      }).lean();
    } else {
      // Create new user
      const newUser = {
        id: uid(),
        authProvider: dto.authProvider,
        authId: dto.authId,
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
      { id: userId },
      'communityMemberships',
      communityId,
      'User'
    );
  }

  async removeCommunityMembership(userId: string, communityId: string): Promise<User> {
    return MongoArrayUpdateHelper.removeFromArray<User>(
      this.userModel,
      { id: userId },
      'communityMemberships',
      communityId,
      'User'
    );
  }

  async getUserCommunities(userId: string): Promise<string[]> {
    const user = await this.userModel.findOne({ id: userId }).lean();
    return user?.communityMemberships || [];
  }

  async isUserMemberOfCommunity(userId: string, communityId: string): Promise<boolean> {
    const user = await this.userModel.findOne({
      id: userId,
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

  async updateProfile(userId: string, profileData: {
    bio?: string;
    location?: { region: string; city: string };
    website?: string;
    values?: string;
    about?: string;
    contacts?: { email: string; messenger: string };
  }): Promise<User> {
    const user = await this.userModel.findOne({ id: userId });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    // Update profile fields using dot notation
    if (profileData.bio !== undefined) {
      updateData['profile.bio'] = profileData.bio;
    }
    if (profileData.location !== undefined) {
      updateData['profile.location'] = profileData.location;
    }
    if (profileData.website !== undefined) {
      updateData['profile.website'] = profileData.website || null;
    }
    if (profileData.values !== undefined) {
      updateData['profile.values'] = profileData.values;
    }
    if (profileData.about !== undefined) {
      updateData['profile.about'] = profileData.about;
    }
    if (profileData.contacts !== undefined) {
      updateData['profile.contacts'] = profileData.contacts;
    }

    await this.userModel.updateOne(
      { id: userId },
      { $set: updateData }
    );

    // Re-fetch user to get updated data
    const updatedUser = await this.userModel.findOne({ id: userId }).lean();
    if (!updatedUser) {
      throw new NotFoundException(`User with id ${userId} not found after update`);
    }
    return updatedUser;
  }
}
