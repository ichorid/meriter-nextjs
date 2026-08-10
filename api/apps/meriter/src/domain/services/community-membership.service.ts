import {
  BadRequestException,
  Injectable,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  COMMUNITY_PERSISTENCE_PORT,
  type CommunityPersistencePort,
  type CommunitySnapshot,
} from '../ports/community.persistence.port';
import type { Community } from '../models/community/community.schema';
import { COMMUNITY_ROLE_LEAD } from '../common/constants/roles.constants';
import { GLOBAL_ROLE_SUPERADMIN } from '../common/constants/roles.constants';
import { TYPE_TAGS_INELIGIBLE_NON_PROJECT_BIRZHA_SOURCE } from '../common/constants/birzha-source-entity.constants';
import { isPriorityCommunity } from '../common/helpers/community.helper';
import { UserService } from './user.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { WalletService } from './wallet.service';

function asCommunity(snapshot: CommunitySnapshot): Community {
  return snapshot as unknown as Community;
}

@Injectable()
export class CommunityMembershipService {
  constructor(
    @Inject(COMMUNITY_PERSISTENCE_PORT)
    private readonly communityPersistence: CommunityPersistencePort,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => UserCommunityRoleService))
    private readonly userCommunityRoleService: UserCommunityRoleService,
    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,
  ) {}

  async addMember(communityId: string, userId: string): Promise<Community> {
    return asCommunity(
      await this.communityPersistence.addArrayItem(communityId, 'members', userId),
    );
  }

  async removeMember(communityId: string, userId: string): Promise<Community> {
    return asCommunity(
      await this.communityPersistence.removeArrayItem(communityId, 'members', userId),
    );
  }

  isLocalMembershipCommunity(community: Community): boolean {
    const tag = community.typeTag;
    if (!tag) {
      return true;
    }
    return !(TYPE_TAGS_INELIGIBLE_NON_PROJECT_BIRZHA_SOURCE as readonly string[]).includes(
      tag,
    );
  }

  async leaveLocalCommunity(
    community: Community,
    userId: string,
    communityId: string,
  ): Promise<void> {
    if (community.isProject === true) {
      throw new BadRequestException('Use leave project for projects');
    }
    if (isPriorityCommunity(community)) {
      throw new BadRequestException('Cannot leave priority communities');
    }
    if (!this.isLocalMembershipCommunity(community)) {
      throw new BadRequestException('Cannot leave this community type');
    }
    const role = await this.userCommunityRoleService.getRole(userId, communityId);
    if (!role) {
      throw new BadRequestException('You are not a member of this community');
    }
    if (role.role === COMMUNITY_ROLE_LEAD) {
      throw new BadRequestException(
        'Lead cannot leave; promote another lead first',
      );
    }

    await this.walletService.removeUserWalletAndTransactionsForCommunity(
      userId,
      communityId,
    );
    await this.removeMember(communityId, userId);
    await this.userService.removeCommunityMembership(userId, communityId);
    await this.userCommunityRoleService.removeRole(userId, communityId);
  }

  async isUserAdmin(communityId: string, userId: string): Promise<boolean> {
    const user = await this.userService.getUserById(userId);
    if (user?.globalRole === GLOBAL_ROLE_SUPERADMIN) {
      return true;
    }
    const userRole = await this.userCommunityRoleService.getRole(userId, communityId);
    if (userRole?.role === COMMUNITY_ROLE_LEAD) {
      return true;
    }
    return false;
  }

  async isUserMember(communityId: string, userId: string): Promise<boolean> {
    return this.communityPersistence.isUserMember(communityId, userId);
  }
}
