import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UzzService } from '../../domain/services/uzz/uzz.service';
import { INV_21_CRON_PATHS } from './inv-21-cron-paths';

/** Daily demurrage sweep for UZZ banks. */
@Injectable()
export class UzzDemurrageCronEntrypoint {
  constructor(private readonly uzzService: UzzService) {}

  @Cron(INV_21_CRON_PATHS.uzzDemurrage.schedule)
  async applyDemurrage(): Promise<void> {
    await this.uzzService.applyDemurrage();
  }

  @Cron(INV_21_CRON_PATHS.uzzDealExpiry.schedule)
  async expireStaleDeals(): Promise<void> {
    await this.uzzService.expireStaleDeals();
  }
}
