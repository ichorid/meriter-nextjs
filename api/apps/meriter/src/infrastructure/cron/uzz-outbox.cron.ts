import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UzzCronService } from '../../adapters/cron/cron.service';
import { SYSTEM_CLOCK } from '../../application/uzz/ports/clock.port';
import { UZZ_UNIT_OF_WORK, UzzUnitOfWork } from '../../application/uzz/ports/uzz-unit-of-work';
import { DeliverUzzOutboxUseCase } from '../../application/uzz/use-cases/deliver-uzz-outbox.use-case';
import { uzzOperationalMetrics } from '../uzz/observability/uzz-operational-metrics';

@Injectable()
export class UzzOutboxCronEntrypoint {
  private readonly logger = new Logger(UzzOutboxCronEntrypoint.name);
  private readonly ops: UzzCronService;

  constructor(
    private readonly deliver: DeliverUzzOutboxUseCase,
    @Inject(UZZ_UNIT_OF_WORK) unitOfWork: UzzUnitOfWork,
  ) {
    this.ops = new UzzCronService({
      metrics: uzzOperationalMetrics,
      unitOfWork,
      clock: SYSTEM_CLOCK,
      logger: this.logger,
    });
  }

  @Cron('*/30 * * * * *')
  async deliverAvailable(): Promise<void> {
    const result = await this.deliver.executeBatch({ limit: 100 });
    await this.ops.publishOutboxDelivery(result);
  }
}
