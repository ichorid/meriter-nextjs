import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import type { AppConfig } from '../../config/configuration';
import type { CommunityDocument } from '../../domain/models/community/community.schema';
import type { UserCommunityRoleService } from '../../domain/services/user-community-role.service';
import type { UserService } from '../../domain/services/user.service';

export type TelegramCommunityListItem = {
  communityId: string;
  name: string;
  telegramChatId: string;
};

export type ResolveTelegramCommunityResult = TelegramCommunityListItem | null;

export type ResolveTelegramCommunityDeps = {
  userService: UserService;
  userCommunityRoleService: UserCommunityRoleService;
  communityModel: Model<CommunityDocument>;
  configService: ConfigService<AppConfig>;
};

/**
 * Resolve TG-linked communities for a Telegram-authenticated user.
 */
export class ResolveTelegramCommunityUseCase {
  private readonly logger = new Logger(ResolveTelegramCommunityUseCase.name);

  constructor(private readonly deps: ResolveTelegramCommunityDeps) {}

  async listForUser(userId: string): Promise<TelegramCommunityListItem[]> {
    const user = await this.deps.userService.getUserById(userId);
    if (!user) return [];

    const memberships = user.communityMemberships ?? [];
    if (memberships.length === 0) return [];

    const tgCommunities = await this.deps.communityModel
      .find({
        id: { $in: memberships },
        telegramChatId: { $exists: true, $nin: [null, ''] },
        telegramFrozenAt: { $exists: false },
      })
      .lean();

    const items: TelegramCommunityListItem[] = [];
    for (const community of tgCommunities) {
      const role = await this.deps.userCommunityRoleService.getRole(
        userId,
        community.id,
      );
      if (!role) {
        continue;
      }
      items.push({
        communityId: community.id,
        name: community.name,
        telegramChatId: String(community.telegramChatId),
      });
    }

    items.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return items;
  }

  async execute(userId: string): Promise<ResolveTelegramCommunityResult> {
    const list = await this.listForUser(userId);
    if (list.length === 0) {
      return null;
    }

    const defaultId =
      this.deps.configService.get('app')?.defaultTelegramCommunityId?.trim();
    if (defaultId) {
      const match = list.find((c) => c.communityId === defaultId);
      if (match) {
        return match;
      }
    }

    if (list.length > 1) {
      this.logger.debug(
        `User ${userId} belongs to ${list.length} TG communities; returning first for legacy resolve`,
      );
    }

    return list[0];
  }
}
