import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { QuotaResetModule } from '../../domain/services/quota-reset.module';
import { PostClosingCronModule } from '../../domain/services/post-closing-cron.module';
import { DocumentWaveCronModule } from '../../domain/services/document-wave-cron.module';
import { QuotaResetCronEntrypoint } from './quota-reset.cron';
import { PostClosingCronEntrypoint } from './post-closing.cron';
import { DocumentWaveCronEntrypoint } from './document-wave.cron';
import { DomainModule } from '../../domain.module';
import { UzzDemurrageCronEntrypoint } from './uzz-demurrage.cron';

/**
 * BC-14 cron composition root (Phase 2 shell).
 *
 * Registers quota-reset, post-closing, document-wave, and uzz-demurrage entrypoints.
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    QuotaResetModule,
    PostClosingCronModule,
    DocumentWaveCronModule,
    DomainModule,
  ],
  providers: [
    QuotaResetCronEntrypoint,
    PostClosingCronEntrypoint,
    DocumentWaveCronEntrypoint,
    UzzDemurrageCronEntrypoint,
  ],
  exports: [
    QuotaResetCronEntrypoint,
    PostClosingCronEntrypoint,
    DocumentWaveCronEntrypoint,
    UzzDemurrageCronEntrypoint,
  ],
})
export class CronInfrastructureModule {}
