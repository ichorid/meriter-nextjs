import { Injectable } from '@nestjs/common';
import {
  UzzNotificationPayload,
  UzzNotificationSender,
} from '../../../application/uzz/ports/uzz-notification-sender.port';
import { TgBotsService } from '../../../domain/services/tg-bots.service';

@Injectable()
export class TelegramUzzNotificationSender implements UzzNotificationSender {
  constructor(private readonly telegram: TgBotsService) {}

  async send(_eventId: string, payload: UzzNotificationPayload): Promise<void> {
    await this.telegram.tgSend({
      tgChatId: payload.telegramUserId,
      text: payload.text,
    });
  }
}
