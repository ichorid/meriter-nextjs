import { Body, Controller, HttpCode, Logger, Param, Post } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import * as TelegramTypes from '@common/extapis/telegram/telegram.types';
import { TgBotsService } from '../../domain/services/tg-bots.service';
import { TelegramBotOrchestratorService } from './telegram-bot.orchestrator.service';

/**
 * BC-19 Telegram Bot API webhook ingress (OD-4).
 * Path matches setup-webhook.js: /api/telegram/hooks/:botUsername
 *
 * Returns HTTP 200 immediately so Telegram does not retry while work continues.
 * Mini-app tRPC and webhook handlers share one API process on the pilot VPS — blocking
 * here previously stalled bot replies during Mini App boot storms.
 */
@Controller('api/telegram/hooks')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private readonly tgBotsService: TgBotsService,
    private readonly telegramBotOrchestrator: TelegramBotOrchestratorService,
  ) {}

  @Post(':botUsername')
  @HttpCode(200)
  async handleWebhook(
    @Param('botUsername') botUsername: string,
    @Body() body: TelegramTypes.Update,
  ): Promise<{ ok: true }> {
    this.logger.debug('Telegram webhook ingress', {
      botUsername,
      updateId: body.update_id,
    });

    const processing = this.processUpdate(botUsername, body);
    if (process.env.NODE_ENV === 'test') {
      await processing;
    }

    return { ok: true };
  }

  private async processUpdate(
    botUsername: string,
    body: TelegramTypes.Update,
  ): Promise<void> {
    try {
      await this.telegramBotOrchestrator.handleUpdate(body);
    } catch (err) {
      this.logger.error('telegram.webhook.error', {
        botUsername,
        updateId: body.update_id,
        err,
      });
      if (process.env.SENTRY_DSN) {
        Sentry.captureException(err, {
          tags: { platform: 'backend', component: 'telegram-webhook' },
          extra: { updateId: body.update_id, botUsername },
        });
      }
    }
  }
}
