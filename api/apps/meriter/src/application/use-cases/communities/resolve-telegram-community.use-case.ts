import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import type { AppConfig } from '../../config/configuration';
import type { CommunityDocument } from '../../domain/models/community/community.schema';
import type { UserCommunityRoleService } from '../../domain/services/user-community-role.service';
import { mongoActiveTelegramCommunityFilter } from '../../../infrastructure/telegram/telegram-community-frozen.util';

export type TelegramCommunityListItem = {
  communityId: string;
  name: string;
  telegramChatId: string;
};

export type ResolveTelegramCommunityResult = TelegramCommunityListItem | null;

export type ResolveTelegramCommunityDeps = {
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
    const roles = await this.deps.userCommunityRoleService.getUserRoles(userId);
    if (roles.length === 0) {
      return [];
    }

    const communityIds = [...new Set(roles.map((r) => r.communityId))];
    const tgCommunities = await this.deps.communityModel
      .find({
        id: { $in: communityIds },
        telegramChatId: { $exists: true, $nin: [null, ''] },
        ...mongoActiveTelegramCommunityFilter(),
      })
      .lean();

    const items: TelegramCommunityListItem[] = tgCommunities.map((community) => ({
      communityId: community.id,
      name: community.name,
      telegramChatId: String(community.telegramChatId),
    }));

    items.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return items;
  }

  async execute(userId: string): Promise<ResolveTelegramCommunityResult> {
    const list = await this.listForUser(userId);
    if (list.length === 0) {
      return null;
    }

    if (list.length > 1) {
      this.logger.debug(
        `User ${userId} belongs to ${list.length} TG communities; resolve requires explicit pick`,
      );
      return null;
    }

    const only = list[0]!;
    const defaultId =
      this.deps.configService.get('app')?.defaultTelegramCommunityId?.trim();
    if (defaultId && only.communityId !== defaultId) {
      this.logger.debug(
        `User ${userId} single TG community ${only.communityId} differs from default ${defaultId}`,
      );
    }

    return only;
  }
}
