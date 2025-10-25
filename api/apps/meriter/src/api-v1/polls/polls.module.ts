import { Module } from '@nestjs/common';
import { PollsController } from './polls.controller';
import { PollsService } from './polls.service';
import { PublicationsService } from '../../publications/publications.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { WalletsService } from '../../wallets/wallets.service';
import { TgBotsService } from '../../tg-bots/tg-bots.service';
import { ConfigService } from '@nestjs/config';

@Module({
  controllers: [PollsController],
  providers: [
    PollsService,
    PublicationsService,
    TransactionsService,
    WalletsService,
    TgBotsService,
    ConfigService,
  ],
})
export class PollsModule {}
