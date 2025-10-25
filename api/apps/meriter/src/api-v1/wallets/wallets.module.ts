import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { DomainModule } from '../../domain.module';

@Module({
  imports: [DomainModule],
  controllers: [WalletsController],
  providers: [WalletsService],
})
export class WalletsModule {}
