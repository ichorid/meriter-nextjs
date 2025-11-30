import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { User, UserDocument } from '../models/user/user.schema';
import {
  Community,
  CommunityDocument,
} from '../models/community/community.schema';
import { UserId } from '../value-objects';
import { EventBus } from '../events/event-bus';
import { MongoArrayUpdateHelper } from '../common/helpers/mongo-array-update.helper';
import { uid } from 'uid';
import { CommunityService } from './community.service';
import { WalletService } from './wallet.service';

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
    @InjectModel(Community.name)
    private communityModel: Model<CommunityDocument>,
    @Inject(forwardRef(() => CommunityService))
    private communityService: CommunityService,
    @Inject(forwardRef(() => WalletService))
    private walletService: WalletService,
  ) {}

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
      if (error.code !== 27) {
        // 27 is IndexNotFound
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

  async getUserByAuthId(
    authProvider: string,
    authId: string,
  ): Promise<User | null> {
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
    let user = await this.userModel
      .findOne({
        authProvider: dto.authProvider,
        authId: dto.authId,
      })
      .lean();

    if (user) {
      // Update existing user
      // Note: $set preserves fields not in updateData (e.g., communityTags, communityMemberships)
      const updateData: any = {
        username: dto.username,
        firstName: dto.firstName,
        lastName: dto.lastName,
        displayName:
          dto.displayName ||
          `${dto.firstName || ''} ${dto.lastName || ''}`.trim(),
        avatarUrl: dto.avatarUrl,
        updatedAt: new Date(),
      };

      if (token) {
        updateData.token = token;
      }

      // Update profile fields if provided (using dot notation for nested fields)
      if (
        dto.bio !== undefined ||
        dto.location !== undefined ||
        dto.website !== undefined ||
        dto.isVerified !== undefined
      ) {
        if (dto.bio !== undefined) updateData['profile.bio'] = dto.bio;
        if (dto.location !== undefined)
          updateData['profile.location'] = dto.location;
        if (dto.website !== undefined)
          updateData['profile.website'] = dto.website;
        if (dto.isVerified !== undefined)
          updateData['profile.isVerified'] = dto.isVerified;
      }

      await this.userModel.updateOne(
        { authProvider: dto.authProvider, authId: dto.authId },
        { $set: updateData },
      );
      // Re-fetch user to get updated data including preserved communityTags and communityMemberships
      user = await this.userModel
        .findOne({
          authProvider: dto.authProvider,
          authId: dto.authId,
        })
        .lean();
    } else {
      // Create new user
      const newUser = {
        id: uid(),
        authProvider: dto.authProvider,
        authId: dto.authId,
        username: dto.username,
        firstName: dto.firstName,
        lastName: dto.lastName,
        displayName:
          dto.displayName ||
          `${dto.firstName || ''} ${dto.lastName || ''}`.trim(),
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

  /**
   * Ensure user is a member of base communities (Future Vision and Marathon of Good)
   * This should be called after user creation or on first login
   * Performs complete membership setup:
   * 1. Adds user to community's members list
   * 2. Adds community to user's memberships
   * 3. Creates wallet for user in community
   */
  async ensureUserInBaseCommunities(userId: string): Promise<void> {
    this.logger.log(`Ensuring user ${userId} is in base communities`);

    // Get base communities by typeTag
    const futureVision = await this.communityModel
      .findOne({ typeTag: 'future-vision' })
      .lean();
    const marathonOfGood = await this.communityModel
      .findOne({ typeTag: 'marathon-of-good' })
      .lean();

    if (!futureVision || !marathonOfGood) {
      this.logger.warn(
        'Base communities not found. They should be created on server startup.',
      );
      return;
    }

    // Check if user is already a member
    const user = await this.userModel.findOne({ id: userId }).lean();
    if (!user) {
      this.logger.error(`User ${userId} not found`);
      return;
    }

    const memberships = user.communityMemberships || [];
    const needsToJoinFV = !memberships.includes(futureVision.id);
    const needsToJoinMG = !memberships.includes(marathonOfGood.id);

    // Add user to Future Vision if needed
    if (needsToJoinFV) {
      this.logger.log(`Adding user ${userId} to Future Vision`);
      try {
        // 1. Add user to community's members list
        await this.communityService.addMember(futureVision.id, userId);
        // 2. Add community to user's memberships
        await this.addCommunityMembership(userId, futureVision.id);
        // 3. Create wallet for user in community
        const currency = futureVision.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        };
        await this.walletService.createOrGetWallet(
          userId,
          futureVision.id,
          currency,
        );
        this.logger.log(`User ${userId} successfully added to Future Vision`);
      } catch (error) {
        this.logger.error(
          `Failed to add user ${userId} to Future Vision: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // Add user to Marathon of Good if needed
    if (needsToJoinMG) {
      this.logger.log(`Adding user ${userId} to Marathon of Good`);
      try {
        // 1. Add user to community's members list
        await this.communityService.addMember(marathonOfGood.id, userId);
        // 2. Add community to user's memberships
        await this.addCommunityMembership(userId, marathonOfGood.id);
        // 3. Create wallet for user in community
        const currency = marathonOfGood.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        };
        await this.walletService.createOrGetWallet(
          userId,
          marathonOfGood.id,
          currency,
        );
        this.logger.log(
          `User ${userId} successfully added to Marathon of Good`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to add user ${userId} to Marathon of Good: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    if (!needsToJoinFV && !needsToJoinMG) {
      this.logger.log(`User ${userId} already in base communities`);
    }
  }

  async addCommunityMembership(
    userId: string,
    communityId: string,
  ): Promise<User> {
    return MongoArrayUpdateHelper.addToArray<User>(
      this.userModel,
      { id: userId },
      'communityMemberships',
      communityId,
      'User',
    );
  }

  async removeCommunityMembership(
    userId: string,
    communityId: string,
  ): Promise<User> {
    return MongoArrayUpdateHelper.removeFromArray<User>(
      this.userModel,
      { id: userId },
      'communityMemberships',
      communityId,
      'User',
    );
  }

  async getUserCommunities(userId: string): Promise<string[]> {
    const user = await this.userModel.findOne({ id: userId }).lean();
    return user?.communityMemberships || [];
  }

  async isUserMemberOfCommunity(
    userId: string,
    communityId: string,
  ): Promise<boolean> {
    const user = await this.userModel
      .findOne({
        id: userId,
        communityMemberships: communityId,
      })
      .lean();
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

  async getUsersByCommunity(
    communityId: string,
    limit: number = 50,
    skip: number = 0,
  ): Promise<User[]> {
    return this.userModel
      .find({ communityMemberships: communityId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean();
  }

  async updateProfile(
    userId: string,
    profileData: {
      bio?: string;
      location?: { region: string; city: string };
      website?: string;
      values?: string;
      about?: string;
      contacts?: { email: string; messenger: string };
    },
  ): Promise<User> {
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

    await this.userModel.updateOne({ id: userId }, { $set: updateData });

    // Re-fetch user to get updated data
    const updatedUser = await this.userModel.findOne({ id: userId }).lean();
    if (!updatedUser) {
      throw new NotFoundException(
        `User with id ${userId} not found after update`,
      );
    }
    return updatedUser;
  }
}
