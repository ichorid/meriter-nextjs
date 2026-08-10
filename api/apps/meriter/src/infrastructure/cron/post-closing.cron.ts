import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PostClosingCronService } from '../../domain/services/post-closing-cron.service';
import { INV_21_CRON_PATHS } from './inv-21-cron-paths';

/** inv-21 entrypoints — D-5/D-6/D-7 schedules; logic stays in {@link PostClosingCronService}. */
@Injectable()
export class PostClosingCronEntrypoint {
  constructor(private readonly postClosingCronService: PostClosingCronService) {}

  @Cron(INV_21_CRON_PATHS.postClosing.ttlAutoClose.schedule)
  async closeExpiredTtlPosts(): Promise<void> {
    await this.postClosingCronService.closeExpiredTtlPosts();
  }

  @Cron(INV_21_CRON_PATHS.postClosing.ttlWarning.schedule)
  async sendTtlWarningNotifications(): Promise<void> {
    await this.postClosingCronService.sendTtlWarningNotifications();
  }

  @Cron(INV_21_CRON_PATHS.postClosing.inactivityClose.schedule)
  async closeInactivePostsAndSendWarnings(): Promise<void> {
    await this.postClosingCronService.closeInactivePostsAndSendWarnings();
  }
}
