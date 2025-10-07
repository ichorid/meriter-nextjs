import { Body, Controller, Param, Post } from '@nestjs/common';
import { Update } from '@common/extapis/telegram/telegram.types';
import { TelegramHookService } from '@common/extapis/telegram/hook/hook.service';

@Controller('/api/telegram/hooks')
export class TelegramHookController {
  constructor(private telegramHookService: TelegramHookService) {}
  @Post(':botUsername')
  telegramHook(
    @Param(':botUsername') botUsername: string,
    @Body() update: Update,
  ) {
    return {};
  }
}
