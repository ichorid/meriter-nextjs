import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { isTelegramMvpMode } from '../../common/helpers/product-mode.helper';
import type { Poll } from '../../domain/aggregates/poll/poll.entity';
import { CommunityService } from '../../domain/services/community.service';
import { PollService } from '../../domain/services/poll.service';
import { TgBotsService } from '../../domain/services/tg-bots.service';
import {
  buildPollOpenKeyboard,
  buildPollResultsMessage,
} from './telegram-messages.ru';

/**
 * Announce results of expired polls in the linked Telegram group
 * (pattern: post-closing cron). Every processed poll is stamped with
 * resultsAnnouncedAt — including polls of communities without a chat —
 * so it is never reprocessed.
 */
@Injectable()
export class TelegramPollResultsCron {
  private readonly logger = new Logger(TelegramPollResultsCron.name);

  constructor(
    private readonly pollService: PollService,
    private readonly communityService: CommunityService,
    private readonly tgBots: TgBotsService,
    private readonly configService: ConfigService<AppConfig>,
  ) {}

  @Cron('*/10 * * * *')
  async announceExpiredPollResults(): Promise<void> {
    const polls = await this.pollService.getExpiredUnannouncedPolls();
    if (polls.length === 0) {
      return;
    }

    this.logger.log(
      `Poll results: found ${polls.length} expired unannounced poll(s)`,
    );

    for (const poll of polls) {
      try {
        await this.processExpiredPoll(poll);
      } catch (err) {
        this.logger.warn(
          `Failed to announce results for poll ${poll.getId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  private async processExpiredPoll(poll: Poll): Promise<void> {
    if (this.shouldAnnounceInTelegram()) {
      await this.trySendResultsMessage(poll);
    }
    await this.pollService.finalizePollResultsAnnouncement(poll.getId);
  }

  private shouldAnnounceInTelegram(): boolean {
    return isTelegramMvpMode(this.configService);
  }

  private async trySendResultsMessage(poll: Poll): Promise<void> {
    const community = await this.communityService.getCommunity(
      poll.getCommunityId,
    );
    const chatId = community?.telegramChatId?.trim();
    if (!chatId || community?.telegramFrozenAt) {
      return;
    }

    const text = buildPollResultsMessage({
      question: poll.getQuestion,
      options: poll.getOptions.map((option) => ({
        text: option.getText,
        amount: option.getAmount,
        amountUp: option.getAmountUp,
        amountDown: option.getAmountDown,
      })),
      casterCount: poll.getMetrics.casterCount,
      totalCasts: poll.getMetrics.totalCasts,
    });
    const botUsername = this.configService
      .get('bot')
      ?.username?.replace(/^@/, '')
      .trim();

    const messageId = await this.tgBots.tgSendMessage({
      chat_id: chatId,
      text,
      reply_markup: botUsername
        ? buildPollOpenKeyboard(botUsername, poll.getId)
        : undefined,
    });
    if (messageId == null) {
      this.logger.warn(
        `Failed to send poll results for ${poll.getId} to telegram chat ${chatId}`,
      );
    }
  }
}
