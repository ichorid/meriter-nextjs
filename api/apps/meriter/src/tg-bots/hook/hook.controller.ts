import { Body, Controller, Get, Logger, Param, Post } from '@nestjs/common';
import { Update } from '@common/extapis/telegram';

import { TgBotsService } from '../tg-bots.service';

@Controller('/api/telegram/hooks')
export class TelegramHookController {
  private readonly logger = new Logger(TelegramHookController.name);

  constructor(private tgBotsService: TgBotsService) {}
  
  @Get(':botUsername')
  echo(@Param('botUsername') botUsername: string) {
    return botUsername;
  }
  
  @Post(':botUsername')
  telegramHook(
    @Param('botUsername') botUsername: string,
    @Body() update: Update,
  ) {
    // Block messages from bots and specific banned chat
    const bannedChatId = process.env.BANNED_CHAT_ID || '-1001765280630';
    if (update?.message?.from?.is_bot==true||update?.message?.chat?.id==Number(bannedChatId)) {
      this.logger.warn('banned message from bot');
      return "ok"
    }
    // Log webhook receipt without sensitive user data
    this.logger.log(`Received webhook for bot: ${botUsername}, update_id: ${update.update_id}`);
    return this.tgBotsService.processHookBody(update, botUsername);
  }
}
