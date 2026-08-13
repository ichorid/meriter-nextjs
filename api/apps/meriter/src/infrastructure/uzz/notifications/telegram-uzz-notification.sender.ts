import { Injectable } from '@nestjs/common';
import {
  UzzNotificationPayload,
  UzzNotificationSender,
} from '../../../application/uzz/ports/uzz-notification-sender.port';
import { TgBotsService } from '../../../domain/services/tg-bots.service';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/configuration';

@Injectable()
export class TelegramUzzNotificationSender implements UzzNotificationSender {
  constructor(
    private readonly telegram: TgBotsService,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  async send(_eventId: string, payload: UzzNotificationPayload): Promise<void> {
    const baseUrl = this.config.get('app')?.uzzWebBaseUrl?.replace(/\/$/, '');
    const link = baseUrl && payload.path ? `${baseUrl}${payload.path}` : null;
    await this.telegram.tgSend({
      tgChatId: payload.telegramUserId,
      text: link ? `${payload.text}\n\n${link}` : payload.text,
    });
  }
}
