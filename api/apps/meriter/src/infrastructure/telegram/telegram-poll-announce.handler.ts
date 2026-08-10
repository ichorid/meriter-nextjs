import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { isTelegramMvpMode } from '../../common/helpers/product-mode.helper';
import { EventBus } from '../../domain/events/event-bus';
import { PollCreatedEvent } from '../../domain/events';
import { CommunityService } from '../../domain/services/community.service';
import { PollService } from '../../domain/services/poll.service';
import { TgBotsService } from '../../domain/services/tg-bots.service';
import {
  buildPollAnnouncementMessage,
  buildPollOpenKeyboard,
} from './telegram-messages.ru';

/**
 * Announce newly created polls in the linked Telegram group
 * (pattern: telegram-publication-mirror.handler.ts).
 */
@Injectable()
export class TelegramPollAnnounceHandler implements OnModuleInit {
  private readonly logger = new Logger(TelegramPollAnnounceHandler.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly pollService: PollService,
    private readonly communityService: CommunityService,
    private readonly tgBots: TgBotsService,
    private readonly configService: ConfigService<AppConfig>,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe('PollCreated', (event) =>
      this.handlePollCreated(event as PollCreatedEvent),
    );
    this.logger.log('Telegram poll announce handler registered');
  }

  private async handlePollCreated(event: PollCreatedEvent): Promise<void> {
    if (!isTelegramMvpMode(this.configService)) {
      return;
    }
    try {
      await this.announcePoll(event.getAggregateId(), event.getCommunityId());
    } catch (error) {
      this.logger.error(
        `Failed to announce poll ${event.getAggregateId()} in Telegram`,
        error,
      );
    }
  }

  private async announcePoll(pollId: string, communityId: string): Promise<void> {
    const community = await this.communityService.getCommunity(communityId);
    const chatId = community?.telegramChatId?.trim();
    if (!chatId || community?.telegramFrozenAt) {
      return;
    }

    const poll = await this.pollService.getPoll(pollId);
    if (!poll) {
      return;
    }

    const text = buildPollAnnouncementMessage({
      question: poll.getQuestion,
      options: poll.getOptions.map((option) => ({ text: option.getText })),
      expiresAt: poll.getExpiresAt,
    });
    const botUsername = this.configService
      .get('bot')
      ?.username?.replace(/^@/, '')
      .trim();

    const messageId = await this.tgBots.tgSendMessage({
      chat_id: chatId,
      text,
      reply_markup: botUsername
        ? buildPollOpenKeyboard(botUsername, pollId)
        : undefined,
    });
    if (messageId == null) {
      this.logger.warn(
        `Failed to announce poll ${pollId} in telegram chat ${chatId}`,
      );
    }
  }
}
