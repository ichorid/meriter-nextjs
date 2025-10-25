import { Module } from '@nestjs/common';
import { TgChatsService } from './tg-chats.service';

@Module({
  providers: [TgChatsService],
  exports: [TgChatsService],
})
export class TgChatsModule {}

