import { Module } from '@nestjs/common';
import { TgChatsService } from '../tg-chats/tg-chats.service';
import { TgChatsModule } from '../tg-chats/tg-chats.module';
import { TgBotsService } from './tg-bots.service';
import { UsersService } from '../users/users.service';
import { PublicationsService } from '../publications/publications.service';
import { HashtagsService } from '../hashtags/hashtags.service';
import { ActorsService } from '@common/abstracts/actors/actors.service';
import { AssetsService } from '@common/abstracts/assets/assets.service';
import { UsersModule } from '../users/users.module';
import { PublicationsModule } from '../publications/publications.module';
import { HashtagsModule } from '../hashtags/hashtags.module';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    TgChatsModule,
    UsersModule,
    PublicationsModule,
    HashtagsModule,
    WalletsModule,
  ],
  providers: [TgBotsService],
  exports: [TgBotsService],
})
export class TgBotsModule {}
