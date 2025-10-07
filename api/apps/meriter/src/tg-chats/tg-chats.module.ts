import { Module } from '@nestjs/common';
import { ActorsModule } from '@common/abstracts/actors/actors.module';
import { TgChatsService } from './tg-chats.service';

@Module({
  imports: [ActorsModule],
  providers: [TgChatsService],
  exports: [TgChatsService],
})
export class TgChatsModule {}
