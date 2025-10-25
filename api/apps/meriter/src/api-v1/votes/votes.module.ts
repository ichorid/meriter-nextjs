import { Module } from '@nestjs/common';
import { VotesController } from './votes.controller';
import { DomainModule } from '../../domain.module';
import { TgBotsModule } from '../../tg-bots/tg-bots.module';

@Module({
  imports: [DomainModule, TgBotsModule],
  controllers: [VotesController],
})
export class VotesModule {}
