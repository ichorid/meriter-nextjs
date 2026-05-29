import { Body, Controller, HttpCode, Logger, Param, Post } from '@nestjs/common';
import * as TelegramTypes from '@common/extapis/telegram/telegram.types';
import { TgBotsService } from '../../domain/services/tg-bots.service';

/**
 * BC-19 Telegram Bot API webhook ingress (OD-4).
 * Path matches setup-webhook.js: /api/telegram/hooks/:botUsername
 */
@Controller('api/telegram/hooks')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(private readonly tgBotsService: TgBotsService) {}

  @Post(':botUsername')
  @HttpCode(200)
  async handleWebhook(
    @Param('botUsername') botUsername: string,
    @Body() body: TelegramTypes.Update,
  ): Promise<{ ok: true }> {
    this.logger.debug(`Telegram webhook for @${botUsername}`);
    await this.tgBotsService.processHookBody(body, botUsername);
    return { ok: true };
  }
}
