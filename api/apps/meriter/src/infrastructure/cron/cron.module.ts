import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { QuotaResetModule } from '../../domain/services/quota-reset.module';
import { PostClosingCronModule } from '../../domain/services/post-closing-cron.module';
import { DocumentWaveCronModule } from '../../domain/services/document-wave-cron.module';
import { QuotaResetCronEntrypoint } from './quota-reset.cron';
import { PostClosingCronEntrypoint } from './post-closing.cron';
import { DocumentWaveCronEntrypoint } from './document-wave.cron';

/**
 * BC-14 cron composition root (Phase 2 shell).
 *
 * Registers quota-reset, post-closing, and document-wave entrypoints. Import this
 * module from `meriter.module.ts` instead of the three per-job modules when wiring
 * is complete; remove interim `@Cron` decorators from domain services then.
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    QuotaResetModule,
    PostClosingCronModule,
    DocumentWaveCronModule,
  ],
  providers: [
    QuotaResetCronEntrypoint,
    PostClosingCronEntrypoint,
    DocumentWaveCronEntrypoint,
  ],
  exports: [
    QuotaResetCronEntrypoint,
    PostClosingCronEntrypoint,
    DocumentWaveCronEntrypoint,
  ],
})
export class CronInfrastructureModule {}
