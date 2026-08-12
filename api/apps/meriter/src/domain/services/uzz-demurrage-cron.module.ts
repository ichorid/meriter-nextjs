import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DomainModule } from '../../domain.module';
import { UzzDemurrageCronEntrypoint } from '../../infrastructure/cron/uzz-demurrage.cron';

@Module({
  imports: [ScheduleModule.forRoot(), DomainModule],
  providers: [UzzDemurrageCronEntrypoint],
})
export class UzzDemurrageCronModule {}
