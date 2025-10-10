import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramHookService } from './hook/hook.service';

@Module({
  providers: [TelegramService, TelegramHookService],
  exports: [TelegramService],
  controllers: [],
})
export class TelegramModule {}
