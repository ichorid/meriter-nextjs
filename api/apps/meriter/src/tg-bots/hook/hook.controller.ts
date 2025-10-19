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
    this.logger.log(`🌐 Webhook received: bot=${botUsername}, update_id=${update.update_id}`);
    
    // Block messages from bots and specific banned chat
    const bannedChatId = process.env.BANNED_CHAT_ID || '-1001765280630';
    if (update?.message?.from?.is_bot==true||update?.message?.chat?.id==Number(bannedChatId)) {
      this.logger.warn(`🚫 Blocked: bot=${update?.message?.from?.is_bot}, chat=${update?.message?.chat?.id}`);
      return "ok"
    }
    
    // Log basic message info
    if (update?.message) {
      const msgType = update.message.text ? 'text' : 
                      update.message.new_chat_members ? 'new_members' : 
                      update.message.photo ? 'photo' : 'other';
      this.logger.log(`📬 Message type: ${msgType}, from: ${update.message.from?.id}, chat: ${update.message.chat?.id}`);
    }
    
    return this.tgBotsService.processHookBody(update, botUsername);
  }
}
