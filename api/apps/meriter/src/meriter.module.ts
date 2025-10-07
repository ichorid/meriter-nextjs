import { Module } from '@nestjs/common';
import { MeriterController } from './meriter.controller';
import { MeriterService } from './meriter.service';

import { join } from 'path';

import { RestApiModule } from './rest-api/rest-api.module';
import { DatabaseModule } from '@common/abstracts/helpers/database/database.module';

import { TelegramModule } from 'nestjs-telegram';
import { BOT_TOKEN } from './config';
import { TelegramHookController } from './tg-bots/hook/hook.controller';
import { TgBotsService } from './tg-bots/tg-bots.service';
import { TgChatsService } from './tg-chats/tg-chats.service';
import { UsersService } from './users/users.service';
import { HashtagsService } from './hashtags/hashtags.service';
import { PublicationsService } from './publications/publications.service';
import { AssetsModule } from '@common/abstracts/assets/assets.module';
import { ActorsModule } from '@common/abstracts/actors/actors.module';
import { CountersModule } from '@common/abstracts/counters/counters.module';
import { AgreementsModule } from '@common/abstracts/agreements/agreements.module';
import { UpdatesConductorsService } from './updates-conductors/updates-conductors.service';
import { UpdatesConductorsModule } from './updates-conductors/updates-conductors.module';
import { TgChatsModule } from './tg-chats/tg-chats.module';
import { TgBotsModule } from './tg-bots/tg-bots.module';
import { UsersModule } from './users/users.module';
import { PublicationsModule } from './publications/publications.module';
import { HashtagsModule } from './hashtags/hashtags.module';
import { WalletsModule } from './wallets/wallets.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    AssetsModule,
    CountersModule,
    ActorsModule,
    AgreementsModule,
    DatabaseModule,
    RestApiModule,
    UpdatesConductorsModule,
    TgBotsModule,
    UsersModule,
    PublicationsModule,
    HashtagsModule,
    WalletsModule,
    TransactionsModule,
  ],
  controllers: [MeriterController, TelegramHookController],
  providers: [MeriterService],
})
export class MeriterModule {}
