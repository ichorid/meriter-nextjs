import { Module } from '@nestjs/common';
import { ThanksController } from './thanks.controller';
import { ThanksService } from './thanks.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { PublicationsService } from '../../publications/publications.service';
import { TgBotsService } from '../../tg-bots/tg-bots.service';
import { WalletsService } from '../../wallets/wallets.service';

@Module({
  controllers: [ThanksController],
  providers: [
    ThanksService,
    TransactionsService,
    PublicationsService,
    TgBotsService,
    WalletsService,
  ],
})
export class ThanksModule {}
