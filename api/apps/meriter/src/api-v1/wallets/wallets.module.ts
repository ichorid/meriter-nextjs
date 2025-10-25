import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { WalletsService as LegacyWalletsService } from '../../wallets/wallets.service';
import { TransactionsService } from '../../transactions/transactions.service';

@Module({
  controllers: [WalletsController],
  providers: [
    WalletsService,
    LegacyWalletsService,
    TransactionsService,
  ],
})
export class WalletsModule {}
