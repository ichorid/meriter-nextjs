import { Module } from '@nestjs/common';
import { ThanksController } from './thanks.controller';
import { ThanksService } from './thanks.service';
import { DomainModule } from '../../domain.module';
import { TgBotsModule } from '../../tg-bots/tg-bots.module';

@Module({
  imports: [DomainModule, TgBotsModule],
  controllers: [ThanksController],
  providers: [ThanksService],
})
export class ThanksModule {}
