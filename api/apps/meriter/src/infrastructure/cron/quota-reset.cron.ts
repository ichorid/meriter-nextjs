import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { QuotaResetService } from '../../domain/services/quota-reset.service';
import { INV_21_CRON_PATHS } from './inv-21-cron-paths';

/** inv-21 entrypoint — delegates to {@link QuotaResetService} (logic stays in domain). */
@Injectable()
export class QuotaResetCronEntrypoint {
  constructor(private readonly quotaResetService: QuotaResetService) {}

  @Cron(INV_21_CRON_PATHS.quotaReset.schedule)
  async resetAllCommunitiesQuotaAtMidnight(): Promise<void> {
    await this.quotaResetService.resetAllCommunitiesQuotaAtMidnight();
  }
}
