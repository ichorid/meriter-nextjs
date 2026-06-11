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
import type { User } from '../models/user/user.schema';
import type { Community } from '../models/community/community.schema';
import { uid } from 'uid';
import { CommunityService } from './community.service';
import { WalletService } from './wallet.service';
import { WalletContextResolverService } from './wallet-context-resolver.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { GLOBAL_ROLE_SUPERADMIN } from '../common/constants/roles.constants';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';
import {
  PROVISION_BASE_MEMBERSHIP_PORT,
  type ProvisionBaseMembershipPort,
} from '../ports/provision-base-membership.port';
import {
  USER_PERSISTENCE_PORT,
  type UserPersistencePort,
} from '../ports/user.persistence.port';

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
    @Inject(USER_PERSISTENCE_PORT)
    private readonly userPersistence: UserPersistencePort,
    @Inject(forwardRef(() => CommunityService))
    private communityService: CommunityService,
    @Inject(forwardRef(() => WalletService))
    private walletService: WalletService,
    @Inject(forwardRef(() => UserCommunityRoleService))
    private userCommunityRoleService: UserCommunityRoleService,
    @Inject(PROVISION_BASE_MEMBERSHIP_PORT)
    private readonly provisionBaseMembershipUseCase: ProvisionBaseMembershipPort,
    private readonly walletContextResolverService: WalletContextResolverService,
  ) {}

  async onModuleInit() {
    try {
      // Drop legacy index on telegramId if it exists
      if (await this.userPersistence.indexExists('telegramId_1')) {
        this.logger.log('Dropping legacy index: telegramId_1');
        await this.userPersistence.dropIndex('telegramId_1');
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
    return (await this.userPersistence.findById(userId)) as User | null;
  }

  async getUserById(id: string): Promise<User | null> {
    return (await this.userPersistence.findById(id)) as User | null;
  }

  /**
   * Batch load users for enrichment (display name + avatar). Prefer this over N× getUserById
   * to avoid connection-pool pressure and slow serial/parallel fan-out.
   */
  async getUsersByIdsForEnrichment(
    ids: string[],
  ): Promise<Map<string, Pick<User, 'id' | 'displayName' | 'avatarUrl'>>> {
    const unique = [...new Set(ids.filter(Boolean))];
    const result = new Map<string, Pick<User, 'id' | 'displayName' | 'avatarUrl'>>();
    if (unique.length === 0) {
      return result;
    }
    const docs = await this.userPersistence.findForEnrichment(unique);
    for (const d of docs) {
      result.set(d.id, {
        id: d.id,
        displayName: d.displayName,
        avatarUrl: d.avatarUrl,
      });
    }
    return result;
  }

  /**
   * Resolve display names for Meriter user ids (batch). Missing users get a short id fallback.
   */
  async getDisplayNamesByUserIds(userIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(userIds.filter(Boolean))];
    const result = new Map<string, string>();
    if (unique.length === 0) {
      return result;
    }
    const docs = await this.userPersistence.findForDisplayNames(unique);
    for (const d of docs) {
      const name = (d.displayName ?? '').trim();
      result.set(d.id, name.length > 0 ? name : d.id);
    }
    for (const id of unique) {
      if (!result.has(id)) {
        result.set(id, id.length > 8 ? `${id.slice(0, 8)}…` : id);
      }
    }
    return result;
  }

  async getUserByAuthId(
    authProvider: string,
    authId: string,
  ): Promise<User | null> {
    return (await this.userPersistence.findByAuth(authProvider, authId)) as User | null;
  }

  async getUserByToken(token: string): Promise<User | null> {
    return (await this.userPersistence.findByToken(token)) as User | null;
  }

  async getUserByCredentialId(credentialId: string): Promise<User | null> {
    return (await this.userPersistence.findByCredentialId(credentialId)) as User | null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return (await this.userPersistence.findByUsername(username)) as User | null;
  }



  async createOrUpdateUser(dto: CreateUserDto, token?: string): Promise<User> {
    // Check if user exists
    let user = await this.userPersistence.findByAuth(dto.authProvider, dto.authId);

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

      await this.userPersistence.updateByAuth(
        dto.authProvider,
        dto.authId,
        updateData,
      );
      // Re-fetch user to get updated data including preserved communityTags and communityMemberships
      user = await this.userPersistence.findByAuth(dto.authProvider, dto.authId);
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

      await this.userPersistence.create(newUser);
      user = await this.userPersistence.findById(newUser.id);

      this.logger.log(`Created user found in DB: ${user ? 'yes' : 'no'}`);
      if (!user) {
        this.logger.error(`Failed to create user with id ${newUser.id}`);
        throw new Error(`Failed to create user with id ${newUser.id}`);
      }
    }

    if (!user) {
      throw new Error(`User not found after createOrUpdateUser`);
    }

    return user as User;
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
    return this.provisionBaseMembershipUseCase.execute(userId);
  }

  async addCommunityMembership(
    userId: string,
    communityId: string,
  ): Promise<User> {
    await this.userPersistence.addCommunityMembership(userId, communityId);
    const updated = await this.userPersistence.findById(userId);
    if (!updated) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    return updated as User;
  }

  async removeCommunityMembership(
    userId: string,
    communityId: string,
  ): Promise<User> {
    await this.userPersistence.removeCommunityMembership(userId, communityId);
    const updated = await this.userPersistence.findById(userId);
    if (!updated) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    return updated as User;
  }

  /**
   * Returns user's community memberships (real communities only).
   * __global__ is a wallet-only id and must never be returned as a community.
   */
  async getUserCommunities(userId: string): Promise<string[]> {
    const memberships = await this.userPersistence.getCommunityMemberships(userId);
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
    if (!this.communityService.isLocalMembershipCommunity(community)) {
      throw new BadRequestException(
        'Can only add to local communities (team, project, custom, etc.)',
      );
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
    const walletCommunityId =
      await this.walletContextResolverService.resolvePersonalWalletCommunityId(
        community,
        'voting',
      );
    await this.walletService.createOrGetWallet(
      targetUserId,
      walletCommunityId,
      currency,
      {
        startingMeritsIfNewWallet: this.communityService.startingMeritsOnJoin(community),
      },
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
    const walletCommunityId =
      await this.walletContextResolverService.resolvePersonalWalletCommunityId(
        community,
        'voting',
      );
    await this.walletService.createOrGetWallet(
      targetUserId,
      walletCommunityId,
      currency,
      {
        startingMeritsIfNewWallet: this.communityService.startingMeritsOnJoin(community),
      },
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
   * Local communities where the current user is a member (lead or participant)
   * and the target user is not yet a member. Used for profile invites.
   */
  async getInvitableCommunities(
    currentUserId: string,
    targetUserId: string,
  ): Promise<Community[]> {
    const currentRoles =
      await this.userCommunityRoleService.getUserRoles(currentUserId);
    const candidateIds = [
      ...new Set(
        currentRoles.map((r) => r.communityId).filter(Boolean) as string[],
      ),
    ];

    const targetRoles = await this.userCommunityRoleService.getUserRoles(
      targetUserId,
    );
    const targetCommunityIds = new Set(
      targetRoles.map((r) => r.communityId.toString()),
    );

    const communities = await Promise.all(
      candidateIds.map((id) => this.communityService.getCommunity(id)),
    );

    return communities.filter(
      (c): c is Community =>
        c !== null &&
        this.communityService.isLocalMembershipCommunity(c) &&
        !targetCommunityIds.has(c.id.toString()),
    );
  }

  async isUserMemberOfCommunity(
    userId: string,
    communityId: string,
  ): Promise<boolean> {
    return this.userPersistence.isMemberOfCommunity(userId, communityId);
  }

  async getAllUsers(limit: number = 50, skip: number = 0): Promise<User[]> {
    return (await this.userPersistence.findAll(limit, skip)) as User[];
  }

  async getUsersByCommunity(
    communityId: string,
    limit: number = 50,
    skip: number = 0,
  ): Promise<User[]> {
    return (await this.userPersistence.findByCommunity(
      communityId,
      limit,
      skip,
    )) as User[];
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
    const user = await this.userPersistence.findById(userId);
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

    await this.userPersistence.updateById(userId, updateData);

    // Re-fetch user to get updated data
    const updatedUser = await this.userPersistence.findById(userId);
    if (!updatedUser) {
      throw new NotFoundException(
        `User with id ${userId} not found after update`,
      );
    }
    return updatedUser as User;
  }

  async updateUser(userId: string, updateData: Partial<User>): Promise<User> {
    await this.userPersistence.updateById(userId, updateData as Record<string, unknown>);
    const user = await this.userPersistence.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return user as User;
  }

  async searchUsers(query: string, limit: number = 20): Promise<User[]> {
    return (await this.userPersistence.search(query, limit)) as User[];
  }

  async updateGlobalRole(
    userId: string,
    role: 'superadmin' | 'user',
  ): Promise<User> {
    const user = await this.userPersistence.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    const updated = await this.userPersistence.setGlobalRole(
      userId,
      role === GLOBAL_ROLE_SUPERADMIN ? GLOBAL_ROLE_SUPERADMIN : undefined,
      new Date(),
    );
    if (!updated) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    return updated as User;
  }
}
