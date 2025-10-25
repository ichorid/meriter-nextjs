import { Module } from '@nestjs/common';
import { PollsController } from './polls.controller';
import { DomainModule } from '../../domain.module';
import { TgBotsModule } from '../../tg-bots/tg-bots.module';

@Module({
  imports: [DomainModule, TgBotsModule],
  controllers: [PollsController],
})
export class PollsModule {}
