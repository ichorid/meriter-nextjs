import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { isTelegramMvpMode } from '../../common/helpers/product-mode.helper';
import type { MeritTransferRecord } from '../../domain/ports/create-merit-transfer.port';
import type { MeritTransferGroupNotifyPort } from '../../domain/ports/merit-transfer-group-notify.port';
import { CommunityService } from '../../domain/services/community.service';
import { TgBotsService } from '../../domain/services/tg-bots.service';
import { UserService } from '../../domain/services/user.service';
import { meritTransferGroupMessage } from './telegram-messages.ru';

@Injectable()
export class TelegramMeritTransferGroupNotifier implements MeritTransferGroupNotifyPort {
  private readonly logger = new Logger(TelegramMeritTransferGroupNotifier.name);

  constructor(
    private readonly tgBots: TgBotsService,
    private readonly userService: UserService,
    private readonly communityService: CommunityService,
    private readonly configService: ConfigService<AppConfig>,
  ) {}

  async announceTransfer(record: MeritTransferRecord): Promise<void> {
    if (!isTelegramMvpMode(this.configService)) {
      return;
    }

    const community = await this.communityService.getCommunity(record.communityContextId);
    const chatId = community?.telegramChatId?.trim();
    if (!chatId || community?.telegramFrozenAt) {
      return;
    }

    const names = await this.userService.getDisplayNamesByUserIds([
      record.senderId,
      record.receiverId,
    ]);
    const senderName = names.get(record.senderId)?.trim() || 'Участник';
    const receiverName = names.get(record.receiverId)?.trim() || 'участник';
    const text = meritTransferGroupMessage(
      senderName,
      receiverName,
      record.amount,
      record.comment,
    );

    const messageId = await this.tgBots.tgSendMessage({ chat_id: chatId, text });
    if (messageId == null) {
      this.logger.warn(
        `Failed to announce merit transfer ${record.id} in telegram chat ${chatId}`,
      );
    }
  }
}
