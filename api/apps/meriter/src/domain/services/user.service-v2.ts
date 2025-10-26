import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, ClientSession } from 'mongoose';
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
export class UserServiceV2 {
  private readonly logger = new Logger(UserServiceV2.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectConnection() private mongoose: Connection,
    private eventBus: EventBus,
  ) {}

  private shouldUseTransactions(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  async getUser(userId: string): Promise<User | null> {
    // Direct Mongoose query
    const doc = await this.userModel.findOne({ telegramId: userId }).lean();
    return doc;
  }

  async getUserByTelegramId(telegramId: string): Promise<User | null> {
    return this.getUser(telegramId);
  }

  async getUserByToken(token: string): Promise<User | null> {
    const doc = await this.userModel.findOne({ token }).lean();
    return doc;
  }

  async createOrUpdateUser(dto: CreateUserDto, token?: string): Promise<User> {
    const useTransactions = this.shouldUseTransactions();
    const session = useTransactions ? await this.mongoose.startSession() : null;
    
    if (useTransactions) {
      session.startTransaction();
    }

    try {
      // Check if user exists
      let user = useTransactions 
        ? await this.userModel.findOne({ telegramId: dto.telegramId }, null, { session }).lean()
        : await this.userModel.findOne({ telegramId: dto.telegramId }).lean();
      
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

        if (useTransactions) {
          await this.userModel.updateOne(
            { telegramId: dto.telegramId },
            { $set: updateData },
            { session }
          );
          user = { ...user, ...updateData };
        } else {
          await this.userModel.updateOne(
            { telegramId: dto.telegramId },
            { $set: updateData }
          );
          user = { ...user, ...updateData };
        }
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

        if (useTransactions) {
          await this.userModel.create([newUser], { session });
          user = await this.userModel.findOne({ id: newUser.id }, null, { session }).lean();
        } else {
          await this.userModel.create([newUser]);
          user = await this.userModel.findOne({ id: newUser.id }).lean();
        }
      }

      if (useTransactions) {
        await session.commitTransaction();
      }
      return user;
    } catch (error) {
      if (useTransactions) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  async addCommunityMembership(userId: string, communityId: string): Promise<User> {
    const useTransactions = this.shouldUseTransactions();
    const session = useTransactions ? await this.mongoose.startSession() : null;
    
    if (useTransactions) {
      session.startTransaction();
    }

    try {
      const user = useTransactions
        ? await this.userModel.findOne({ telegramId: userId }, null, { session }).lean()
        : await this.userModel.findOne({ telegramId: userId }).lean();
      
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Add community to memberships if not already present
      const updatedUser = useTransactions
        ? await this.userModel.findOneAndUpdate(
            { telegramId: userId },
            { 
              $addToSet: { communityMemberships: communityId },
              $set: { updatedAt: new Date() }
            },
            { new: true, session }
          ).lean()
        : await this.userModel.findOneAndUpdate(
            { telegramId: userId },
            { 
              $addToSet: { communityMemberships: communityId },
              $set: { updatedAt: new Date() }
            },
            { new: true }
          ).lean();

      if (useTransactions) {
        await session.commitTransaction();
      }
      return updatedUser;
    } catch (error) {
      if (useTransactions) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  async removeCommunityMembership(userId: string, communityId: string): Promise<User> {
    const useTransactions = this.shouldUseTransactions();
    const session = useTransactions ? await this.mongoose.startSession() : null;
    
    if (useTransactions) {
      session.startTransaction();
    }

    try {
      const user = useTransactions
        ? await this.userModel.findOne({ telegramId: userId }, null, { session }).lean()
        : await this.userModel.findOne({ telegramId: userId }).lean();
      
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Remove community from memberships
      const updatedUser = useTransactions
        ? await this.userModel.findOneAndUpdate(
            { telegramId: userId },
            { 
              $pull: { communityMemberships: communityId },
              $set: { updatedAt: new Date() }
            },
            { new: true, session }
          ).lean()
        : await this.userModel.findOneAndUpdate(
            { telegramId: userId },
            { 
              $pull: { communityMemberships: communityId },
              $set: { updatedAt: new Date() }
            },
            { new: true }
          ).lean();

      if (useTransactions) {
        await session.commitTransaction();
      }
      return updatedUser;
    } catch (error) {
      if (useTransactions) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
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
