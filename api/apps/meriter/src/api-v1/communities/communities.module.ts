import { Module } from '@nestjs/common';
import { CommunitiesController } from './communities.controller';
import { PublicationsController } from '../publications/publications.controller';
import { DomainModule } from '../../domain.module';
import { TgBotsModule } from '../../tg-bots/tg-bots.module';

@Module({
  imports: [DomainModule, TgBotsModule],
  controllers: [CommunitiesController, PublicationsController],
})
export class CommunitiesModule {}
