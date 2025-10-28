import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { User, UserDocument } from '../models/user/user.schema';
import { UserId } from '../value-objects';
import { EventBus } from '../events/event-bus';
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
      const updateData = {
        username: dto.username,
        firstName: dto.firstName,
        lastName: dto.lastName,
        displayName: dto.displayName || `${dto.firstName || ''} ${dto.lastName || ''}`.trim(),
        avatarUrl: dto.avatarUrl,
        bio: dto.bio,
        location: dto.location,
        website: dto.website,
        isVerified: dto.isVerified,
        updatedAt: new Date(),
      };

      if (token) {
        updateData['token'] = token;
      }

      await this.userModel.updateOne(
        { telegramId: dto.telegramId },
        { $set: updateData }
      );
      user = { ...user, ...updateData };
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
    const user = await this.userModel.findOne({ telegramId: userId }).lean();
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Add community to memberships if not already present
    const updatedUser = await this.userModel.findOneAndUpdate(
      { telegramId: userId },
      { 
        $addToSet: { communityMemberships: communityId },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    ).lean();

    return updatedUser;
  }

  async removeCommunityMembership(userId: string, communityId: string): Promise<User> {
    const user = await this.userModel.findOne({ telegramId: userId }).lean();
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Remove community from memberships
    const updatedUser = await this.userModel.findOneAndUpdate(
      { telegramId: userId },
      { 
        $pull: { communityMemberships: communityId },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    ).lean();

    return updatedUser;
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
