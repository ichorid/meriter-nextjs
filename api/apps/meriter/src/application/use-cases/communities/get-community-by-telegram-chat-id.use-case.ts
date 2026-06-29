import { Logger } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { CommunityDocument } from '../../../domain/models/community/community.schema';

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
    const normalized = telegramChatId.trim();
    if (!normalized) return null;

    const doc = await this.deps.communityModel
      .findOne({ telegramChatId: normalized })
      .lean();

    if (!doc?.id) {
      this.logger.debug(`No community for telegramChatId=${normalized}`);
      return null;
    }

    return {
      communityId: doc.id,
      name: doc.name,
      telegramChatId: normalized,
      isFrozen: Boolean(doc.telegramFrozenAt),
    };
  }
}
