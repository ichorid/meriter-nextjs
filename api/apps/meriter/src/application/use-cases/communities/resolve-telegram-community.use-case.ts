import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import type { AppConfig } from '../../config/configuration';
import type { CommunityDocument } from '../../domain/models/community/community.schema';
import type { UserCommunityRoleService } from '../../domain/services/user-community-role.service';
import type { UserService } from '../../domain/services/user.service';

export type ResolveTelegramCommunityResult = {
  communityId: string;
  name: string;
  telegramChatId: string;
} | null;

export type ResolveTelegramCommunityDeps = {
  userService: UserService;
  userCommunityRoleService: UserCommunityRoleService;
  communityModel: Model<CommunityDocument>;
  configService: ConfigService<AppConfig>;
};

/**
 * Resolve the single TG-linked community for a Telegram-authenticated user (P2 pilot).
 */
export class ResolveTelegramCommunityUseCase {
  private readonly logger = new Logger(ResolveTelegramCommunityUseCase.name);

  constructor(private readonly deps: ResolveTelegramCommunityDeps) {}

  async execute(userId: string): Promise<ResolveTelegramCommunityResult> {
    const user = await this.deps.userService.getUserById(userId);
    if (!user) return null;

    const memberships = user.communityMemberships ?? [];
    if (memberships.length === 0) return null;

    const tgCommunities = await this.deps.communityModel
      .find({
        id: { $in: memberships },
        telegramChatId: { $exists: true, $nin: [null, ''] },
        telegramFrozenAt: { $exists: false },
      })
      .lean();

    if (tgCommunities.length === 0) return null;

    const defaultId =
      this.deps.configService.get('app')?.defaultTelegramCommunityId?.trim();

    let chosen = tgCommunities[0];
    if (defaultId) {
      const match = tgCommunities.find((c) => c.id === defaultId);
      if (match) chosen = match;
    }

    for (const community of tgCommunities) {
      const role = await this.deps.userCommunityRoleService.getRole(
        userId,
        community.id,
      );
      if (!role) continue;
    }

    const role = await this.deps.userCommunityRoleService.getRole(
      userId,
      chosen.id,
    );
    if (!role) {
      this.logger.warn(
        `User ${userId} has membership doc but no active role in ${chosen.id}`,
      );
      return null;
    }

    return {
      communityId: chosen.id,
      name: chosen.name,
      telegramChatId: String(chosen.telegramChatId),
    };
  }
}
