import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserSchemaClass, UserDocument } from '../models/user/user.schema';
import type { User } from '../models/user/user.schema';
import {
  CommunitySchemaClass,
  CommunityDocument,
  type Community,
} from '../models/community/community.schema';
import { MongoArrayUpdateHelper } from '../common/helpers/mongo-array-update.helper';
import { uid } from 'uid';
import { CommunityService } from './community.service';
import { WalletService } from './wallet.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { GLOBAL_ROLE_SUPERADMIN } from '../common/constants/roles.constants';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';

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
  globalRole?: 'superadmin';
  authenticators?: any[];
}

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(UserSchemaClass.name) private userModel: Model<UserDocument>,
    @InjectModel(CommunitySchemaClass.name)
    private communityModel: Model<CommunityDocument>,
    @Inject(forwardRef(() => CommunityService))
    private communityService: CommunityService,
    @Inject(forwardRef(() => WalletService))
    private walletService: WalletService,
    @Inject(forwardRef(() => UserCommunityRoleService))
    private userCommunityRoleService: UserCommunityRoleService,
  ) { }

  async onModuleInit() {
    try {
      // Drop legacy index on telegramId if it exists
      if (await this.userModel.collection.indexExists('telegramId_1')) {
        this.logger.log('Dropping legacy index: telegramId_1');
        await this.userModel.collection.dropIndex('telegramId_1');
        this.logger.log('Legacy index dropped successfully');
      }
    } catch (error: unknown) {
      // Ignore error if index doesn't exist (though indexExists check should prevent this)
      // or if other error occurs, just log it
      if (error && typeof error === 'object' && 'code' in error && error.code === 27) {
        // 27 is IndexNotFound - ignore
        return;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to drop legacy index: ${errorMessage}`);
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

  async getUserByCredentialId(credentialId: string): Promise<User | null> {
    const doc = await this.userModel.findOne({ 'authenticators.credentialID': credentialId }).lean();
    return doc;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const doc = await this.userModel.findOne({ username }).lean();
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

      if (dto.globalRole !== undefined) {
        updateData.globalRole = dto.globalRole;
      }

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
      const newUser: any = {
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
        authenticators: dto.authenticators || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.logger.log(`Creating new user with authenticators count: ${newUser.authenticators?.length}`);

      // Only set globalRole if provided and is 'superadmin' (enum only allows 'superadmin')
      if (dto.globalRole === 'superadmin') {
        newUser.globalRole = 'superadmin';
      }

      await this.userModel.create([newUser]);
      user = await this.userModel.findOne({ id: newUser.id }).lean();

      this.logger.log(`Created user found in DB: ${user ? 'yes' : 'no'}`);
      if (!user) {
        this.logger.error(`Failed to create user with id ${newUser.id}`);
        throw new Error(`Failed to create user with id ${newUser.id}`);
      }
    }

    if (!user) {
      throw new Error(`User not found after createOrUpdateUser`);
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
    const teamProjects = await this.communityModel
      .findOne({ typeTag: 'team-projects' })
      .lean();
    const support = await this.communityModel
      .findOne({ typeTag: 'support' })
      .lean();

    // Log warnings for missing communities but continue processing available ones
    if (!futureVision) {
      this.logger.warn('Future Vision community not found');
    }
    if (!marathonOfGood) {
      this.logger.warn('Marathon of Good community not found');
    }
    if (!teamProjects) {
      this.logger.warn('Team Projects community not found');
    }
    if (!support) {
      this.logger.warn('Support community not found');
    }

    // Check if user is already a member
    const user = await this.userModel.findOne({ id: userId }).lean();
    if (!user) {
      this.logger.error(`User ${userId} not found`);
      return;
    }

    const memberships = user.communityMemberships || [];
    const needsToJoinFV = futureVision && !memberships.includes(futureVision.id);
    const needsToJoinMG = marathonOfGood && !memberships.includes(marathonOfGood.id);
    const needsToJoinTP = teamProjects && !memberships.includes(teamProjects.id);
    const needsToJoinSupport = support && !memberships.includes(support.id);

    // G-12: Ensure global wallet exists for user (used by priority communities)
    const defaultCurrency = { singular: 'merit', plural: 'merits', genitive: 'merits' };
    await this.walletService.createOrGetWallet(userId, GLOBAL_COMMUNITY_ID, defaultCurrency);

    // G-10: Credit 100 welcome merits to global wallet on first registration
    const isNewToBaseCommunities =
      needsToJoinFV || needsToJoinMG || needsToJoinTP || needsToJoinSupport;
    if (isNewToBaseCommunities) {
      try {
        await this.walletService.creditWelcomeMeritsIfNeeded(userId);
      } catch (err) {
        this.logger.warn(
          `Failed to credit welcome merits to user ${userId}: ${err instanceof Error ? err.message : 'Unknown'}`,
        );
      }
    }

    // Add user to Future Vision if needed
    if (needsToJoinFV && futureVision) {
      this.logger.log(`Adding user ${userId} to Future Vision`);
      try {
        // 1. Check if user has any role in this community
        const existingRole = await this.userCommunityRoleService.getRole(
          userId,
          futureVision.id,
        );

        // 2. Add user to community's members list
        await this.communityService.addMember(futureVision.id, userId);
        // 3. Add community to user's memberships
        await this.addCommunityMembership(userId, futureVision.id);

        // 4. Assign participant role if user has no role (joining without invite)
        if (!existingRole) {
          await this.userCommunityRoleService.setRole(
            userId,
            futureVision.id,
            'participant',
            true, // skipSync to prevent recursion
          );
          this.logger.log(
            `Assigned participant role to user ${userId} in Future Vision (no invite)`,
          );
        }

        // 5. Create wallet for user in community
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
    if (needsToJoinMG && marathonOfGood) {
      this.logger.log(`Adding user ${userId} to Marathon of Good`);
      try {
        // 1. Check if user has any role in this community
        const existingRole = await this.userCommunityRoleService.getRole(
          userId,
          marathonOfGood.id,
        );

        // 2. Add user to community's members list
        await this.communityService.addMember(marathonOfGood.id, userId);
        // 3. Add community to user's memberships
        await this.addCommunityMembership(userId, marathonOfGood.id);

        // 4. Assign participant role if user has no role (joining without invite)
        if (!existingRole) {
          await this.userCommunityRoleService.setRole(
            userId,
            marathonOfGood.id,
            'participant',
            true, // skipSync to prevent recursion
          );
          this.logger.log(
            `Assigned participant role to user ${userId} in Marathon of Good (no invite)`,
          );
        }

        // 5. Create wallet for user in community
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

    // Add user to Team Projects if needed
    if (needsToJoinTP && teamProjects) {
      this.logger.log(`Adding user ${userId} to Team Projects`);
      try {
        // 1. Check if user has any role in this community
        const existingRole = await this.userCommunityRoleService.getRole(
          userId,
          teamProjects.id,
        );

        // 2. Add user to community's members list
        await this.communityService.addMember(teamProjects.id, userId);
        // 3. Add community to user's memberships
        await this.addCommunityMembership(userId, teamProjects.id);

        // 4. Assign participant role if user has no role (joining without invite)
        // Everyone gets participant role by default
        if (!existingRole) {
          await this.userCommunityRoleService.setRole(
            userId,
            teamProjects.id,
            'participant',
            true, // skipSync to prevent recursion
          );
          this.logger.log(
            `Assigned participant role to user ${userId} in Team Projects (no invite)`,
          );
        }

        // 5. Create wallet for user in community
        const currency = teamProjects.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        };
        await this.walletService.createOrGetWallet(
          userId,
          teamProjects.id,
          currency,
        );
        this.logger.log(
          `User ${userId} successfully added to Team Projects`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to add user ${userId} to Team Projects: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // Add user to Support if needed
    if (needsToJoinSupport && support) {
      this.logger.log(`Adding user ${userId} to Support`);
      try {
        // 1. Check if user has any role in this community
        const existingRole = await this.userCommunityRoleService.getRole(
          userId,
          support.id,
        );

        // 2. Add user to community's members list
        await this.communityService.addMember(support.id, userId);
        // 3. Add community to user's memberships
        await this.addCommunityMembership(userId, support.id);

        // 4. Assign participant role if user has no role (joining without invite)
        if (!existingRole) {
          await this.userCommunityRoleService.setRole(
            userId,
            support.id,
            'participant',
            true, // skipSync to prevent recursion
          );
          this.logger.log(
            `Assigned participant role to user ${userId} in Support (no invite)`,
          );
        }

        // 5. Create wallet for user in community
        const currency = support.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        };
        await this.walletService.createOrGetWallet(
          userId,
          support.id,
          currency,
        );
        this.logger.log(`User ${userId} successfully added to Support`);
      } catch (error) {
        this.logger.error(
          `Failed to add user ${userId} to Support: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    if (!needsToJoinFV && !needsToJoinMG && !needsToJoinTP && !needsToJoinSupport) {
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

  /**
   * Returns user's community memberships (real communities only).
   * __global__ is a wallet-only id and must never be returned as a community.
   */
  async getUserCommunities(userId: string): Promise<string[]> {
    const user = await this.userModel.findOne({ id: userId }).lean();
    const memberships = user?.communityMemberships || [];
    return memberships.filter((id) => id !== GLOBAL_COMMUNITY_ID);
  }

  /**
   * Add user to a team (local community)
   * Internal method that performs the actual addition of user to team
   * Used by TeamInvitationService when invitation is accepted
   */
  async addUserToTeam(
    inviterId: string,
    targetUserId: string,
    communityId: string,
  ): Promise<void> {
    this.logger.log(
      `Adding user ${targetUserId} to team ${communityId} (invited by ${inviterId})`,
    );

    // 1. Check that community is a team (not global)
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    if (community.typeTag !== 'team') {
      throw new BadRequestException('Can only add to team communities');
    }

    // 2. Check that target is not already a member
    const targetRole = await this.userCommunityRoleService.getRole(
      targetUserId,
      communityId,
    );
    if (targetRole) {
      throw new BadRequestException(
        'User is already a member of this community',
      );
    }

    // 3. Assign participant role
    await this.userCommunityRoleService.setRole(
      targetUserId,
      communityId,
      'participant',
    );

    // 4. Create wallet
    const currency = community.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };
    await this.walletService.createOrGetWallet(
      targetUserId,
      communityId,
      currency,
    );

    // 5. Add to lists
    await this.communityService.addMember(communityId, targetUserId);
    await this.addCommunityMembership(targetUserId, communityId);

    this.logger.log(
      `User ${targetUserId} successfully added to team ${communityId}`,
    );
  }

  /**
   * Invite user to a team (local community)
   * Only leads can invite to their teams
   * Creates an invitation that requires user confirmation
   * @deprecated Use TeamInvitationService.createInvitation instead
   */
  async inviteToTeam(
    inviterId: string,
    targetUserId: string,
    communityId: string,
  ): Promise<void> {
    // This method is kept for backwards compatibility
    // It now delegates to addUserToTeam for direct addition (used by TeamJoinRequestService)
    // For new invitations with confirmation, use TeamInvitationService.createInvitation
    await this.addUserToTeam(inviterId, targetUserId, communityId);
  }

  /**
   * Assign user as lead of a community
   * Only superadmins can assign leads
   */
  async assignLead(
    adminId: string,
    targetUserId: string,
    communityId: string,
  ): Promise<void> {
    this.logger.log(
      `Assigning user ${targetUserId} as lead in ${communityId} by admin ${adminId}`,
    );

    // 1. Check that admin is superadmin
    const admin = await this.getUserById(adminId);
    if (admin?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
      throw new ForbiddenException('Only superadmins can assign leads');
    }

    // 2. Check that community exists
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    // 3. Assign lead role
    await this.userCommunityRoleService.setRole(
      targetUserId,
      communityId,
      'lead',
    );

    // 4. Ensure wallet exists
    const currency = community.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };
    await this.walletService.createOrGetWallet(
      targetUserId,
      communityId,
      currency,
    );

    // 5. Add to lists (if not already added)
    const isMember = await this.communityService.isUserMember(
      communityId,
      targetUserId,
    );
    if (!isMember) {
      await this.communityService.addMember(communityId, targetUserId);
      await this.addCommunityMembership(targetUserId, communityId);
    }

    this.logger.log(
      `Admin ${adminId} assigned ${targetUserId} as lead in ${communityId}`,
    );
  }

  /**
   * Get communities where user is lead
   */
  async getLeadCommunities(userId: string): Promise<Community[]> {
    const roles = await this.userCommunityRoleService.getUserRoles(userId);
    const leadRoles = roles.filter((r) => r.role === 'lead');
    const communityIds = leadRoles.map((r) => r.communityId);

    if (communityIds.length === 0) {
      return [];
    }

    const communities = await Promise.all(
      communityIds.map((id) => this.communityService.getCommunity(id)),
    );

    return communities.filter((c): c is Community => c !== null);
  }

  /**
   * Get communities where current user is lead and target user is not a member
   * Used for inviting users to teams
   */
  async getInvitableCommunities(
    currentUserId: string,
    targetUserId: string,
  ): Promise<Community[]> {
    // Get communities where current user is lead
    const leadCommunities = await this.getLeadCommunities(currentUserId);

    // Get communities where target user is already a member
    const targetRoles = await this.userCommunityRoleService.getUserRoles(
      targetUserId,
    );
    const targetCommunityIds = new Set(
      targetRoles.map((r) => r.communityId.toString()),
    );

    // Filter: only team communities where target is not a member
    return leadCommunities.filter(
      (c) =>
        c.typeTag === 'team' &&
        !targetCommunityIds.has(c.id.toString()),
    );
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
      displayName?: string;
      avatarUrl?: string;
      bio?: string;
      location?: { region: string; city: string };
      website?: string;
      about?: string;
      contacts?: { email: string; messenger: string };
      educationalInstitution?: string;
    },
  ): Promise<User> {
    const user = await this.userModel.findOne({ id: userId });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    // Update top-level user fields
    if (profileData.displayName !== undefined) {
      updateData['displayName'] = profileData.displayName;
    }
    if (profileData.avatarUrl !== undefined) {
      updateData['avatarUrl'] = profileData.avatarUrl;
    }

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
    if (profileData.about !== undefined) {
      updateData['profile.about'] = profileData.about;
    }
    if (profileData.contacts !== undefined) {
      updateData['profile.contacts'] = profileData.contacts;
    }
    if (profileData.educationalInstitution !== undefined) {
      updateData['profile.educationalInstitution'] = profileData.educationalInstitution;
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

  async updateUser(userId: string, updateData: Partial<User>): Promise<User> {
    await this.userModel.updateOne({ id: userId }, { $set: updateData });
    const user = await this.userModel.findOne({ id: userId }).lean();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async searchUsers(query: string, limit: number = 20): Promise<User[]> {
    const regex = new RegExp(query, 'i');
    return this.userModel
      .find({
        $or: [
          { username: regex },
          { displayName: regex },
          { firstName: regex },
          { lastName: regex },
          { 'profile.contacts.email': regex },
        ],
      })
      .limit(limit)
      .lean();
  }

  async updateGlobalRole(
    userId: string,
    role: 'superadmin' | 'user',
  ): Promise<User> {
    const user = await this.userModel.findOne({ id: userId });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    if (role === GLOBAL_ROLE_SUPERADMIN) {
      user.globalRole = GLOBAL_ROLE_SUPERADMIN;
    } else {
      user.globalRole = undefined;
    }

    user.updatedAt = new Date();
    await user.save();

    return user.toObject();
  }
}
