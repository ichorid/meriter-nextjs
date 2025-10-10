import { Module } from '@nestjs/common';
import { CountersModule } from '@common/abstracts/counters/counters.module';
import { WalletsService } from './wallets.service';
import { WalletsResolver } from './wallets.resolver';

@Module({
  imports: [CountersModule],
  providers: [WalletsService, WalletsResolver],
  exports: [WalletsService],
})
export class WalletsModule {}
