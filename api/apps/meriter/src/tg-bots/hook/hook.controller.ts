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
                      update.message.connected_website ? 'connected_website' :
                      update.message.new_chat_members ? 'new_members' : 
                      update.message.left_chat_member ? 'left_member' :
                      update.message.photo ? 'photo' : 'other';
      this.logger.log(`📬 Message type: ${msgType}, from: ${update.message.from?.id}, chat: ${update.message.chat?.id}`);
      
      // Enhanced logging for left_chat_member events
      if (update.message.left_chat_member) {
        this.logger.log(`🚪 LEFT_CHAT_MEMBER event detected:`, {
          chatId: update.message.chat?.id,
          leftMemberId: update.message.left_chat_member.id,
          leftMemberUsername: update.message.left_chat_member.username,
          leftMemberFirstName: update.message.left_chat_member.first_name,
          isBot: update.message.left_chat_member.is_bot,
          botUsername: botUsername
        });
      }
      
      // Log connected_website events (Telegram authentication notifications)
      if (update.message.connected_website) {
        this.logger.log(`🌐 CONNECTED_WEBSITE event detected:`, {
          chatId: update.message.chat?.id,
          userId: update.message.from?.id,
          username: update.message.from?.username,
          website: update.message.connected_website,
          botUsername: botUsername
        });
      }
    }
    
    // Log my_chat_member events (bot membership changes)
    if (update?.my_chat_member) {
      this.logger.log(`🤖 MY_CHAT_MEMBER event detected:`, {
        chatId: update.my_chat_member.chat?.id,
        chatTitle: update.my_chat_member.chat?.title,
        oldStatus: update.my_chat_member.old_chat_member?.status,
        newStatus: update.my_chat_member.new_chat_member?.status,
        botUsername: botUsername
      });
    }
    
    return this.tgBotsService.processHookBody(update, botUsername);
  }
}
