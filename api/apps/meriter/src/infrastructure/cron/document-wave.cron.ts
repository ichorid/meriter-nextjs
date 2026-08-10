import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DocumentWaveCronService } from '../../domain/services/document-wave-cron.service';
import { INV_21_CRON_PATHS } from './inv-21-cron-paths';

/** inv-21 entrypoint — collaborative-document wave sweep; logic stays in domain. */
@Injectable()
export class DocumentWaveCronEntrypoint {
  constructor(private readonly documentWaveCronService: DocumentWaveCronService) {}

  @Cron(INV_21_CRON_PATHS.documentWave.schedule)
  async sweepExpiredWaves(): Promise<void> {
    await this.documentWaveCronService.sweepExpiredWaves();
  }
}
