import {
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GLOBAL_ROLE_SUPERADMIN } from '../../../domain/common/constants/roles.constants';
import type { CommunityService } from '../../../domain/services/community.service';
import type { NotificationService } from '../../../domain/services/notification.service';
import type { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import type { UserService } from '../../../domain/services/user.service';
import type { WalletService } from '../../../domain/services/wallet.service';

export type AssignLeadInput = {
  adminId: string;
  targetUserId: string;
  communityId: string;
};

export type AssignLeadDeps = {
  userService: UserService;
  communityService: CommunityService;
  userCommunityRoleService: UserCommunityRoleService;
  walletService: WalletService;
  notificationService: NotificationService;
};

/**
 * BC-01: superadmin assigns a user as community lead.
 * inv-08: superadmin authorization before role and membership mutations.
 */
export class AssignLeadUseCase {
  private readonly logger = new Logger(AssignLeadUseCase.name);

  constructor(private readonly deps: AssignLeadDeps) {}

  async execute(input: AssignLeadInput): Promise<{ success: true }> {
    const { adminId, targetUserId, communityId } = input;

    const admin = await this.deps.userService.getUserById(adminId);
    if (admin?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
      throw new ForbiddenException('Only superadmins can assign leads');
    }

    const previous = await this.deps.userCommunityRoleService.getRole(
      targetUserId,
      communityId,
    );

    const community = await this.deps.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    await this.deps.userCommunityRoleService.setRole(
      targetUserId,
      communityId,
      'lead',
    );

    const currency = community.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };
    await this.deps.walletService.createOrGetWallet(
      targetUserId,
      communityId,
      currency,
      {
        startingMeritsIfNewWallet:
          this.deps.communityService.startingMeritsOnJoin(community),
      },
    );

    const isMember = await this.deps.communityService.isUserMember(
      communityId,
      targetUserId,
    );
    if (!isMember) {
      await this.deps.communityService.addMember(communityId, targetUserId);
      await this.deps.userService.addCommunityMembership(targetUserId, communityId);
    }

    this.logger.log(
      `Admin ${adminId} assigned ${targetUserId} as lead in ${communityId}`,
    );

    if (previous?.role !== 'lead') {
      await this.deps.notificationService.notifyCommunityRolePromotedToLead({
        targetUserId,
        actorUserId: adminId,
        communityId,
        communityName: community.name,
        isProject: Boolean(community.isProject),
      });
    }

    return { success: true };
  }
}

export function createAssignLeadUseCase(deps: AssignLeadDeps): AssignLeadUseCase {
  return new AssignLeadUseCase(deps);
}
