import { Module } from '@nestjs/common';
import { CommunitiesController } from './communities.controller';
import { PublicationsController } from '../publications/publications.controller';
import { DomainModule } from '../../domain.module';
import { ApiV1CommonModule } from '../common/common.module';

@Module({
  imports: [DomainModule, ApiV1CommonModule],
  controllers: [CommunitiesController, PublicationsController],
})
export class CommunitiesModule {}
