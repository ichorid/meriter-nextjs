import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DocumentVariantService } from './document-variant.service';

/**
 * Periodic sweep for collaborative-document voting waves (§12.2): finalize elapsed waves,
 * auto-apply in `auto` mode via {@link DocumentVariantService.finalizeExpiredWaveOnBlock}.
 */
@Injectable()
export class DocumentWaveCronService {
  private readonly logger = new Logger(DocumentWaveCronService.name);

  constructor(private readonly documentVariantService: DocumentVariantService) {}

  @Cron('*/5 * * * *')
  async sweepExpiredWaves(): Promise<void> {
    try {
      await this.documentVariantService.runPeriodicWaveSweep();
    } catch (err) {
      this.logger.warn(
        `Document wave sweep failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
