import { Module } from '@nestjs/common';
import { ThanksController } from './thanks.controller';
import { DomainModule } from '../../domain.module';
import { TgBotsModule } from '../../tg-bots/tg-bots.module';

@Module({
  imports: [DomainModule, TgBotsModule],
  controllers: [ThanksController],
})
export class ThanksModule {}
