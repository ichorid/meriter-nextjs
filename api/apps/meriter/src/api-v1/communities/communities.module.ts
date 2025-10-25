import { Module } from '@nestjs/common';
import { CommunitiesController } from './communities.controller';
import { PublicationsController } from '../publications/publications.controller';
import { DomainModule } from '../../domain.module';

@Module({
  imports: [DomainModule],
  controllers: [CommunitiesController, PublicationsController],
})
export class CommunitiesModule {}
