import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { DomainModule } from '../../domain.module';

@Module({
  imports: [DomainModule],
  controllers: [WalletsController],
})
export class WalletsModule {}
