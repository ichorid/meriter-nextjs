import { Module } from '@nestjs/common';
import { DomainModule } from '../../domain.module';
import { ApiV1CommonModule } from '../common/common.module';
import { DocumentEventsController } from './document-events.controller';
import { DocumentLiveAccessService } from './document-live-access.service';

@Module({
  imports: [DomainModule, ApiV1CommonModule],
  controllers: [DocumentEventsController],
  providers: [DocumentLiveAccessService],
})
export class DocumentEventsModule {}
