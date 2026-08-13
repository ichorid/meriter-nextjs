import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DeliverUzzOutboxUseCase } from '../../application/uzz/use-cases/deliver-uzz-outbox.use-case';

@Injectable()
export class UzzOutboxCronEntrypoint {
  private readonly logger = new Logger(UzzOutboxCronEntrypoint.name);
  constructor(private readonly deliver: DeliverUzzOutboxUseCase) {}

  @Cron('*/30 * * * * *')
  async deliverAvailable(): Promise<void> {
    const result = await this.deliver.executeBatch({ limit: 100 });
    if (result.failed > 0 || result.deadLettered > 0) {
      this.logger.warn(
        `UZZ outbox: delivered=${result.delivered} failed=${result.failed} dead=${result.deadLettered}`,
      );
    }
  }
}
