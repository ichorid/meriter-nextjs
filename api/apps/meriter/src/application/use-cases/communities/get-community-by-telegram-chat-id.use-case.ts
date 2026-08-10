import { Logger } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { CommunityDocument } from '../../../domain/models/community/community.schema';
import { createTelegramCommunityChatResolver } from '../../../infrastructure/telegram/telegram-community-chat.resolver';
import { isTelegramCommunityFrozen } from '../../../infrastructure/telegram/telegram-community-frozen.util';

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
    const resolver = createTelegramCommunityChatResolver({
      communityModel: this.deps.communityModel,
    });
    const doc = await resolver.resolveByIncomingChatId(telegramChatId);

    if (!doc?.id) {
      this.logger.debug(`No community for telegramChatId=${telegramChatId}`);
      return null;
    }

    return {
      communityId: doc.id,
      name: doc.name,
      telegramChatId: String(doc.telegramChatId),
      isFrozen: isTelegramCommunityFrozen(doc),
    };
  }
}
