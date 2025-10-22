import { forwardRef, Module } from '@nestjs/common';
import { RestPublicationsController } from './rest/publications/publications.controller';
import { RestCommunityifoController } from './rest/communityinfo/communityinfo.controller';
import { PublicationsService } from '../publications/publications.service';
import { AssetsModule } from '@common/abstracts/assets/assets.module';
import { UsersService } from '../users/users.service';
import { ActorsModule } from '@common/abstracts/actors/actors.module';
import { RestGetmeController } from './rest/getme/getme.controller';
import { TgChatsService } from '../tg-chats/tg-chats.service';
import { TelegramModule } from '@common/extapis/telegram/telegram.module';
import { HashtagsService } from '../hashtags/hashtags.service';
import { WalletsService } from '../wallets/wallets.service';
import { RestFreeController } from './rest/free/free.controller';
import { TransactionsService } from '../transactions/transactions.service';
import { CountersModule } from '@common/abstracts/counters/counters.module';
import { AgreementsModule } from '@common/abstracts/agreements/agreements.module';
import { RestUserdataController } from './rest/userdata/userdata.controller';

import { RestTransactionsController } from './rest/rest-transactions/rest-transactions.controller';
import { RestWalletController } from './rest/wallet/wallet.controller';
import { RestRateController } from './rest/rest-rate/rest-rate.controller';
import { GetchatController } from './rest/getchat/getchat.controller';
import { RestWithdrawController } from './rest/rest-withdraw/rest-withdraw.controller';
import { RestGetmanagedchatsController } from './rest/rest-getmanagedchats/rest-getmanagedchats.controller';
import { RestSpaceController } from './rest/rest-space/rest-space.controller';
import { RestRankController } from './rest/rank/rank.controller';
import { TgBotsService } from '../tg-bots/tg-bots.service';
import { UpdatesConductorsModule } from '../updates-conductors/updates-conductors.module';
import { DatabaseModule } from '@common/abstracts/helpers/database/database.module';
import { SendmemoController } from './rest/sendmemo/sendmemo.controller';
import { RestFreqController } from './rest/rest-freq/rest-freq.controller';
import { RestPollsController } from './rest/rest-polls/rest-polls.controller';
import { TelegramAuthController } from './rest/telegram-auth/telegram-auth.controller';
import { SyncCommunitiesController } from './rest/sync-communities/sync-communities.controller';
import { CheckAdminController } from './rest/check-admin/check-admin.controller';
import { UsersModule } from '../users/users.module';
import { TgBotsModule } from '../tg-bots/tg-bots.module';
import { TgChatsModule } from '../tg-chats/tg-chats.module';
import { PublicationsModule } from '../publications/publications.module';
import { HashtagsModule } from '../hashtags/hashtags.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    AssetsModule,
    ActorsModule,
    TelegramModule,
    CountersModule,
    PublicationsModule,
    HashtagsModule,
    TransactionsModule,
    WalletsModule,
    AgreementsModule,
    UsersModule,
    UpdatesConductorsModule,
    TgChatsModule,
    TgBotsModule,
  ],
  providers: [],
  controllers: [
    RestPublicationsController,
    RestCommunityifoController,
    RestGetmeController,
    RestFreeController,
    RestUserdataController,
    RestTransactionsController,
    RestWalletController,
    RestRateController,
    GetchatController,
    RestWithdrawController,
    RestGetmanagedchatsController,
    RestSpaceController,
    RestRankController,
    SendmemoController,
    RestFreqController,
    RestPollsController,
    TelegramAuthController,
    SyncCommunitiesController,
    CheckAdminController,
  ],
  exports: [],
})
export class RestApiModule {}
