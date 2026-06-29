import { Logger } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { CommunityDocument } from '../../../domain/models/community/community.schema';
import { telegramChatIdLookupVariants } from '../../../infrastructure/telegram/telegram-chat-id.util';

export type GetCommunityByTelegramChatIdResult = {
  communityId: string;
  name: string;
  telegramChatId: string;
  isFrozen: boolean;
} | null;

export type GetCommunityByTelegramChatIdDeps = {
  communityModel: Model<CommunityDocument>;
};

export class GetCommunityByTelegramChatIdUseCase {
  private readonly logger = new Logger(GetCommunityByTelegramChatIdUseCase.name);

  constructor(private readonly deps: GetCommunityByTelegramChatIdDeps) {}

  async execute(telegramChatId: string): Promise<GetCommunityByTelegramChatIdResult> {
    const variants = telegramChatIdLookupVariants(telegramChatId);
    if (variants.length === 0) return null;

    const doc = await this.deps.communityModel
      .findOne({ telegramChatId: { $in: variants } })
      .lean();

    if (!doc?.id) {
      this.logger.debug(`No community for telegramChatId variants=${variants.join(',')}`);
      return null;
    }

    return {
      communityId: doc.id,
      name: doc.name,
      telegramChatId: String(doc.telegramChatId),
      isFrozen: Boolean(doc.telegramFrozenAt),
    };
  }
}
