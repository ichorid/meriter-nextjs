import { Module } from '@nestjs/common';
import { ActorsModule } from '@common/abstracts/actors/actors.module';
import { TgChatsService } from './tg-chats.service';
import { TgChatsResolver } from './tg-chats.resolver';

@Module({
  imports: [ActorsModule],
  providers: [TgChatsService, TgChatsResolver],
  exports: [TgChatsService],
})
export class TgChatsModule {}
