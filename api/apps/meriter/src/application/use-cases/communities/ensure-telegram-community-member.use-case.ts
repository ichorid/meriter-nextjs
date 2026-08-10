import { Logger } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { Community } from '../../../domain/models/community/community.schema';
import type { CommunityDocument } from '../../../domain/models/community/community.schema';
import type { CommunityService } from '../../../domain/services/community.service';
import type { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import type { UserService } from '../../../domain/services/user.service';
import type { WalletService } from '../../../domain/services/wallet.service';

export type EnsureTelegramCommunityMemberDeps = {
  communityModel: Model<CommunityDocument>;
  communityService: CommunityService;
  userCommunityRoleService: UserCommunityRoleService;
  userService: UserService;
  walletService: WalletService;
};

/**
 * Ensure a Telegram-authenticated user can use community-web for a TG-linked community
 * (auto-join on Mini App open when start_param or chat resolves a community).
 */
export class EnsureTelegramCommunityMemberUseCase {
  private readonly logger = new Logger(EnsureTelegramCommunityMemberUseCase.name);

  constructor(private readonly deps: EnsureTelegramCommunityMemberDeps) {}

  async execute(userId: string, communityId: string): Promise<void> {
    const community = await this.deps.communityModel
      .findOne({
        id: communityId,
        telegramChatId: { $exists: true, $nin: [null, ''] },
        telegramFrozenAt: { $exists: false },
      })
      .lean();

    if (!community?.id) {
      this.logger.debug(`Skip auto-join: ${communityId} is not an active TG community`);
      return;
    }

    const role = await this.deps.userCommunityRoleService.getRole(userId, communityId);
    if (role?.membershipStatus !== 'active') {
      await this.deps.communityService.addMember(communityId, userId);
      await this.deps.userCommunityRoleService.setRole(userId, communityId, 'participant', true);
      await this.deps.userService.addCommunityMembership(userId, communityId);
    }

    const currency = community.settings?.currencyNames ?? {
      singular: 'заслуга',
      plural: 'заслуги',
      genitive: 'заслуг',
    };
    await this.deps.walletService.createOrGetWallet(userId, communityId, currency, {
      startingMeritsIfNewWallet: this.deps.communityService.startingMeritsOnJoin(
        community as Community,
      ),
    });
  }
}
