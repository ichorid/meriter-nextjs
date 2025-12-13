import { Module } from '@nestjs/common';
import { CommunitiesController } from './communities.controller';
import { PublicationsController } from '../publications/publications.controller';
import { DomainModule } from '../../domain.module';
import { ApiV1CommonModule } from '../common/common.module';
import { QuotaResetModule } from '../../domain/services/quota-reset.module';

@Module({
  imports: [DomainModule, ApiV1CommonModule, QuotaResetModule],
  controllers: [CommunitiesController, PublicationsController],
})
export class CommunitiesModule {}
