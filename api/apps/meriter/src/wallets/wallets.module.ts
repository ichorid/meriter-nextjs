import { Module } from '@nestjs/common';
import { CountersModule } from '@common/abstracts/counters/counters.module';
import { WalletsService } from './wallets.service';

@Module({
  imports: [CountersModule],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
