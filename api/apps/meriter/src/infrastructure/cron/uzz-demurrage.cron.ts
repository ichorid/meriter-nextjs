import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ApplyDemurrageUseCase } from '../../application/uzz/use-cases/apply-demurrage.use-case';
import { ExpireDealsUseCase } from '../../application/uzz/use-cases/expire-deals.use-case';
import { INV_21_CRON_PATHS } from './inv-21-cron-paths';

/** Daily demurrage sweep for UZZ banks. */
@Injectable()
export class UzzDemurrageCronEntrypoint {
  constructor(
    private readonly demurrage: ApplyDemurrageUseCase,
    private readonly expiry: ExpireDealsUseCase,
  ) {}

  @Cron(INV_21_CRON_PATHS.uzzDemurrage.schedule)
  async applyDemurrage(): Promise<void> {
    let afterId: string | null = null;
    do {
      const page = await this.demurrage.executePage({ afterId, limit: 100 });
      afterId = page.nextAfterId;
    } while (afterId);
  }

  @Cron(INV_21_CRON_PATHS.uzzDealExpiry.schedule)
  async expireStaleDeals(): Promise<void> {
    let afterId: string | null = null;
    do {
      const page = await this.expiry.executePage({ afterId, limit: 100 });
      afterId = page.nextAfterId;
    } while (afterId);
  }
}
