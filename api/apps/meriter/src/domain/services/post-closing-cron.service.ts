import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../models/publication/publication.schema';
import { PostClosingService } from './post-closing.service';
import { CommunityService } from './community.service';
import { NotificationService } from './notification.service';
import { WalletService } from './wallet.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * D-5, D-6, D-7: Scheduled jobs for TTL auto-close, TTL warning, and inactivity close.
 */
@Injectable()
export class PostClosingCronService {
  private readonly logger = new Logger(PostClosingCronService.name);

  constructor(
    @InjectModel(PublicationSchemaClass.name)
    private readonly publicationModel: Model<PublicationDocument>,
    private readonly postClosingService: PostClosingService,
    private readonly communityService: CommunityService,
    private readonly notificationService: NotificationService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * D-5: TTL auto-close — run every hour. Close posts whose TTL has expired.
   * Idempotent: only selects status: 'active', so manually closed posts are skipped.
   */
  @Cron('0 * * * *')
  async closeExpiredTtlPosts(): Promise<void> {
    const now = new Date();
    const posts = await this.publicationModel
      .find({
        status: 'active',
        ttlExpiresAt: { $ne: null, $lt: now },
      })
      .select({ id: 1 })
      .lean()
      .exec();

    if (posts.length === 0) return;

    this.logger.log(
      `[D-5] TTL close: found ${posts.length} post(s) with expired TTL`,
    );

    for (const post of posts) {
      try {
        await this.postClosingService.closePost(post.id, 'ttl');
        this.logger.debug(`[D-5] Closed post ${post.id} (TTL expired)`);
      } catch (err) {
        this.logger.warn(
          `[D-5] Failed to close post ${post.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  /**
   * D-6: TTL warning — run every hour. Notify authors 24h before TTL expiry (once per post).
   */
  @Cron('0 * * * *')
  async sendTtlWarningNotifications(): Promise<void> {
    const now = new Date();
    const in24h = new Date(now.getTime() + MS_PER_DAY);

    const posts = await this.publicationModel
      .find({
        status: 'active',
        ttlExpiresAt: { $gt: now, $lte: in24h },
        $or: [
          { ttlWarningNotified: { $ne: true } },
          { ttlWarningNotified: null },
          { ttlWarningNotified: { $exists: false } },
        ],
      })
      .select({ id: 1, authorId: 1, title: 1 })
      .lean()
      .exec();

    if (posts.length === 0) return;

    this.logger.log(
      `[D-6] TTL warning: found ${posts.length} post(s) expiring within 24h`,
    );

    for (const post of posts) {
      try {
        await this.notificationService.createNotification({
          userId: post.authorId,
          type: 'post_ttl_warning',
          source: 'system',
          metadata: { postId: post.id },
          title: 'Post closing soon',
          message: `Your post "${post.title ?? 'Untitled'}" will close in 24 hours (TTL).`,
        });
        await this.publicationModel.updateOne(
          { id: post.id },
          { $set: { ttlWarningNotified: true } },
        );
        this.logger.debug(`[D-6] Sent TTL warning for post ${post.id}`);
      } catch (err) {
        this.logger.warn(
          `[D-6] Failed to send TTL warning for post ${post.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  /**
   * D-7: Inactivity close — run daily. Close posts that meet inactivity criteria.
   * Also sends 24h warning for posts that will become eligible tomorrow.
   */
  @Cron('0 0 * * *')
  async closeInactivePostsAndSendWarnings(): Promise<void> {
    const now = new Date();

    const candidates = await this.publicationModel
      .find({
        status: 'active',
        $and: [
          { $or: [{ investmentPool: { $exists: false } }, { investmentPool: { $lte: 0 } }] },
          { $or: [{ 'metrics.score': { $exists: false } }, { 'metrics.score': { $lte: 0 } }] },
        ],
        lastEarnedAt: { $exists: true, $ne: null },
      })
      .select({
        id: 1,
        authorId: 1,
        communityId: 1,
        title: 1,
        noAuthorWalletSpend: 1,
        lastEarnedAt: 1,
        inactivityWarningNotified: 1,
      })
      .lean()
      .exec();

    let closed = 0;
    let warned = 0;

    for (const post of candidates) {
      const community = await this.communityService.getCommunity(
        post.communityId,
      );
      // Default 7 days when community setting is not set (schema default is also 7)
      const inactiveCloseDays =
        (community as { settings?: { inactiveCloseDays?: number } })
          ?.settings?.inactiveCloseDays ?? 7;
      const thresholdMs = inactiveCloseDays * MS_PER_DAY;
      const lastEarnedAt = post.lastEarnedAt
        ? new Date(post.lastEarnedAt).getTime()
        : 0;
      const nowMs = now.getTime();

      if (lastEarnedAt >= nowMs - thresholdMs) continue;

      const noAuthorWalletSpend = post.noAuthorWalletSpend ?? false;
      let authorWalletZero = noAuthorWalletSpend;
      if (!noAuthorWalletSpend) {
        const wallet = await this.walletService.getWallet(
          post.authorId,
          post.communityId,
        );
        authorWalletZero = !wallet || wallet.getBalance() <= 0;
      }

      if (!authorWalletZero) continue;

      const daysInactive = (nowMs - lastEarnedAt) / MS_PER_DAY;

      if (daysInactive >= inactiveCloseDays) {
        try {
          await this.postClosingService.closePost(post.id, 'inactive');
          closed++;
          this.logger.debug(`[D-7] Closed inactive post ${post.id}`);
        } catch (err) {
          this.logger.warn(
            `[D-7] Failed to close post ${post.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        continue;
      }

      const inWarningWindow =
        daysInactive >= inactiveCloseDays - 1 &&
        daysInactive < inactiveCloseDays;
      if (inWarningWindow && !(post.inactivityWarningNotified === true)) {
        try {
          await this.notificationService.createNotification({
            userId: post.authorId,
            type: 'post_inactivity_warning',
            source: 'system',
            metadata: { postId: post.id },
            title: 'Post will close soon',
            message: `Your post "${post.title ?? 'Untitled'}" will be closed in 24 hours due to no activity for ${inactiveCloseDays} days.`,
          });
          await this.publicationModel.updateOne(
            { id: post.id },
            { $set: { inactivityWarningNotified: true } },
          );
          warned++;
          this.logger.debug(`[D-7] Sent inactivity warning for post ${post.id}`);
        } catch (err) {
          this.logger.warn(
            `[D-7] Failed to send inactivity warning for post ${post.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    if (closed > 0 || warned > 0) {
      this.logger.log(
        `[D-7] Inactivity: closed ${closed} post(s), sent ${warned} warning(s)`,
      );
    }
  }
}
