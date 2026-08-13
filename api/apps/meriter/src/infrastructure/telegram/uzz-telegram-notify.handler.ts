import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBus } from '../../domain/events/event-bus';
import { UzzNotifyEvent } from '../../domain/events/uzz.events';
import { TgBotsService } from '../../domain/services/tg-bots.service';

@Injectable()
export class UzzTelegramNotifyHandler implements OnModuleInit {
  private readonly logger = new Logger(UzzTelegramNotifyHandler.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly tgBots: TgBotsService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe('UzzNotify', (event) =>
      this.handle(event as UzzNotifyEvent),
    );
    this.logger.log('UZZ Telegram notify handler registered');
  }

  private async handle(event: UzzNotifyEvent): Promise<void> {
    try {
      await this.tgBots.tgSend({
        tgChatId: event.getTelegramUserId(),
        text: event.getText(),
      });
    } catch (error) {
      this.logger.warn('UZZ Telegram notify failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
