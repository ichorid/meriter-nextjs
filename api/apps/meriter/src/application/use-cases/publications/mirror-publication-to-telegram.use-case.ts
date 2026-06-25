import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import type { AppConfig } from '../../config/configuration';
import type {
  CommunityDocument,
} from '../../domain/models/community/community.schema';
import type {
  TelegramPublicationAnchorDocument,
} from '../../domain/models/telegram/telegram-publication-anchor.schema';
import type { PublicationService } from '../../domain/services/publication.service';
import type { UserService } from '../../domain/services/user.service';

export type MirrorPublicationToTelegramDeps = {
  configService: ConfigService<AppConfig>;
  publicationService: PublicationService;
  userService: UserService;
  communityModel: Model<CommunityDocument>;
  anchorModel: Model<TelegramPublicationAnchorDocument>;
};

/**
 * Mirror a web-created publication to the linked Telegram group (card + anchor).
 */
export class MirrorPublicationToTelegramUseCase {
  private readonly logger = new Logger(MirrorPublicationToTelegramUseCase.name);

  constructor(private readonly deps: MirrorPublicationToTelegramDeps) {}

  async execute(publicationId: string, communityId: string): Promise<void> {
    const communityDoc = await this.deps.communityModel
      .findOne({ id: communityId })
      .lean();
    if (!communityDoc?.telegramChatId) {
      return;
    }
    if (communityDoc.telegramFrozenAt) {
      this.logger.debug(
        `Skip TG mirror for ${publicationId}: community ${communityId} frozen`,
      );
      return;
    }

    const existingAnchor = await this.deps.anchorModel
      .findOne({ publicationId })
      .lean();
    if (existingAnchor) {
      return;
    }

    const publication =
      await this.deps.publicationService.getPublication(publicationId);
    if (!publication) return;

    const snap = publication.toSnapshot();
    const title = snap.title?.trim();
    const content = snap.content?.trim() ?? '';
    const body = title ? `${title}\n\n${content}` : content;
    if (!body.trim()) return;

    const author = await this.deps.userService.getUser(snap.authorId);
    const authorLabel =
      author?.displayName ||
      author?.username ||
      [author?.firstName, author?.lastName].filter(Boolean).join(' ') ||
      'Участник';

    const chatId = String(communityDoc.telegramChatId);
    const cardText = `📌 ${authorLabel}\n${body.trim().slice(0, 900)}`;

    const sent = await this.sendPlainMessage(chatId, cardText);
    const messageId = sent?.message_id;
    if (!messageId) {
      this.logger.warn(`TG mirror send failed for publication ${publicationId}`);
      return;
    }

    await this.deps.anchorModel.updateOne(
      { telegramChatId: chatId, telegramMessageId: messageId },
      {
        $set: {
          communityId,
          publicationId,
          anchorType: 'bot_mirror',
          telegramChatId: chatId,
          telegramMessageId: messageId,
        },
      },
      { upsert: true },
    );

    this.logger.log(
      `Mirrored publication ${publicationId} to Telegram chat ${chatId} msg ${messageId}`,
    );
  }

  private async sendPlainMessage(
    chatId: string,
    text: string,
  ): Promise<{ message_id?: number } | null> {
    const token = this.deps.configService.get('bot')?.token;
    if (!token || this.deps.configService.get('noAxios')) {
      return { message_id: Math.floor(Math.random() * 100000) };
    }
    try {
      const Axios = (await import('axios')).default;
      const apiUrl =
        this.deps.configService.get('telegram')?.apiUrl ??
        'https://api.telegram.org';
      const res = await Axios.post(`${apiUrl}/bot${token}/sendMessage`, {
        chat_id: chatId,
        text,
      });
      return res.data?.result ?? null;
    } catch (error) {
      this.logger.warn('Mirror sendPlainMessage failed', error);
      return null;
    }
  }
}
