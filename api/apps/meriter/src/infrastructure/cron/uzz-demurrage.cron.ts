import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UzzCronService } from '../../adapters/cron/cron.service';
import { SYSTEM_CLOCK } from '../../application/uzz/ports/clock.port';
import { UZZ_UNIT_OF_WORK, UzzUnitOfWork } from '../../application/uzz/ports/uzz-unit-of-work';
import { ApplyDemurrageUseCase } from '../../application/uzz/use-cases/apply-demurrage.use-case';
import { ExpireDealsUseCase } from '../../application/uzz/use-cases/expire-deals.use-case';
import { uzzOperationalMetrics } from '../uzz/observability/uzz-operational-metrics';
import { INV_21_CRON_PATHS } from './inv-21-cron-paths';

/** Daily demurrage sweep for UZZ banks. */
@Injectable()
export class UzzDemurrageCronEntrypoint {
  private readonly logger = new Logger(UzzDemurrageCronEntrypoint.name);
  private readonly ops: UzzCronService;

  constructor(
    private readonly demurrage: ApplyDemurrageUseCase,
    expiry: ExpireDealsUseCase,
    @Inject(UZZ_UNIT_OF_WORK) unitOfWork: UzzUnitOfWork,
  ) {
    this.ops = new UzzCronService({
      metrics: uzzOperationalMetrics,
      unitOfWork,
      expiry,
      clock: SYSTEM_CLOCK,
      logger: this.logger,
    });
  }

  @Cron(INV_21_CRON_PATHS.uzzDemurrage.schedule)
  async applyDemurrage(): Promise<void> {
    let afterId: string | null = null;
    let processed = 0;
    do {
      const page = await this.demurrage.executePage({ afterId, limit: 100 });
      processed += page.processed;
      afterId = page.nextAfterId;
    } while (afterId);
    this.logger.log(`UZZ demurrage sweep completed: processed=${processed}`);
  }

  @Cron(INV_21_CRON_PATHS.uzzDealExpiry.schedule)
  async expireStaleDeals(): Promise<void> {
    await this.ops.runExpirySweep();
  }
}
