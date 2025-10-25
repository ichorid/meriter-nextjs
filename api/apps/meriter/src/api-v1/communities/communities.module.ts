import { Module } from '@nestjs/common';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';
import { TgChatsService } from '../../tg-chats/tg-chats.service';
import { TgBotsService } from '../../tg-bots/tg-bots.service';
import { HashtagsService } from '../../hashtags/hashtags.service';
import { ConfigService } from '@nestjs/config';

@Module({
  controllers: [CommunitiesController],
  providers: [
    CommunitiesService,
    TgChatsService,
    TgBotsService,
    HashtagsService,
    ConfigService,
  ],
})
export class CommunitiesModule {}
