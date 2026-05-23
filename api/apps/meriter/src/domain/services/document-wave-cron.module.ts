import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DomainModule } from '../../domain.module';
import { DocumentWaveCronService } from './document-wave-cron.service';

@Module({
  imports: [ScheduleModule.forRoot(), DomainModule],
  providers: [DocumentWaveCronService],
})
export class DocumentWaveCronModule {}
