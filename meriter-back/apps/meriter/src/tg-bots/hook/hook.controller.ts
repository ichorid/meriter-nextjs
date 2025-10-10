import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Update } from '@common/extapis/telegram/telegram.types';

import { TgBotsService } from '../tg-bots.service';

@Controller('/api/telegram/hooks')
export class TelegramHookController {
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
      console.log('banned message from bot');
      return "ok"
    }
    console.log('recieved webhook botUsername',botUsername,JSON.stringify(update,null,2));
    return this.tgBotsService.processHookBody(update, botUsername);
  }
}
