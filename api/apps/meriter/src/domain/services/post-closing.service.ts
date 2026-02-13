import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';
import {
  PublicationSchemaClass,
  PublicationDocument,
  type PublicationClosingSummary,
} from '../models/publication/publication.schema';
import { InvestmentService, HandlePostCloseResult } from './investment.service';
import { PublicationService } from './publication.service';
import { WalletService } from './wallet.service';
import { MeritResolverService } from './merit-resolver.service';
import { CommunityService } from './community.service';
import { NotificationService } from './notification.service';

export type PostCloseReason =
  | 'manual'
  | 'ttl'
  | 'inactive'
  | 'negative_rating';

export interface ClosePostResult {
  closingSummary: PublicationClosingSummary;
}

/**
 * D-2: Atomic post closing: pool return, rating distribution, status update.
 * "Remove from tappalka" is achieved by setting status='closed' (getEligiblePosts excludes closed).
 */
@Injectable()
export class PostClosingService {
  private readonly logger = new Logger(PostClosingService.name);

  constructor(
    @InjectModel(PublicationSchemaClass.name)
    private readonly publicationModel: Model<PublicationDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly investmentService: InvestmentService,
    private readonly publicationService: PublicationService,
    private readonly walletService: WalletService,
    private readonly meritResolverService: MeritResolverService,
    private readonly communityService: CommunityService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Close a post atomically: return pool, distribute rating, set status and summary, then notify.
   * Idempotent: throws if status is not 'active'.
   */
  async closePost(
    postId: string,
    reason: PostCloseReason,
  ): Promise<ClosePostResult> {
    const post = await this.publicationModel
      .findOne({ id: postId })
      .lean()
      .exec();
    if (!post) {
      throw new NotFoundException('Publication not found');
    }

    const status = post.status ?? 'active';
    if (status !== 'active') {
      throw new BadRequestException(
        `Post is not active (status: ${status}). Cannot close.`,
      );
    }

    const currentPool = post.investmentPool ?? 0;
    const investmentPoolTotal = post.investmentPoolTotal ?? 0;
    const beneficiaryId = post.beneficiaryId ?? post.authorId;
    const communityId = post.communityId;

    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    const currency = community.settings?.currencyNames ?? {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };

    let result: HandlePostCloseResult;
    let closingSummary: PublicationClosingSummary;

    const runCloseLogic = async (session: ClientSession | undefined) => {
      result = await this.investmentService.handlePostClose(postId, session);

      if (result.ratingDistributed.authorAmount > 0) {
        const targetCommunityId = this.meritResolverService.getWalletCommunityId(
          community,
          'withdrawal',
        );
        await this.walletService.addTransaction(
          beneficiaryId,
          targetCommunityId,
          'credit',
          result.ratingDistributed.authorAmount,
          'personal',
          'publication_withdrawal',
          postId,
          currency,
          `Withdrawal from publication ${postId} (post closed)`,
          session,
        );
      }

      if (result.totalRatingDistributed > 0) {
        await this.publicationService.reduceScore(
          postId,
          result.totalRatingDistributed,
          session,
        );
      }

      const poolReturnedTotal = result.poolReturned.reduce(
        (sum, p) => sum + p.amount,
        0,
      );
      const distributedToInvestors = result.ratingDistributed.investorDistributions.reduce(
        (sum, d) => sum + d.amount,
        0,
      );

      closingSummary = {
        totalEarned: result.totalRatingDistributed,
        distributedToInvestors,
        authorReceived: result.ratingDistributed.authorAmount,
        spentOnShows: Math.max(0, investmentPoolTotal - currentPool),
        poolReturned: poolReturnedTotal,
      };

      const now = new Date();
      await this.publicationModel.updateOne(
        { id: postId },
        {
          $set: {
            status: 'closed',
            closedAt: now,
            closeReason: reason,
            closingSummary,
            investmentPool: 0,
            'metrics.score': 0,
          },
        },
        session ? { session } : {},
      );
    };

    const transactionErrorMsg =
      'Transaction numbers are only allowed on a replica set member or mongos';

    try {
      const session = await this.connection.startSession();
      try {
        await session.withTransaction(async () => runCloseLogic(session));
      } finally {
        await session.endSession();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes(transactionErrorMsg)) {
        this.logger.warn(
          'MongoDB standalone detected; running post close without transaction',
        );
        await runCloseLogic(undefined);
      } else {
        throw err;
      }
    }

    const res = result!;
    const summary = closingSummary!;

    await this.sendNotifications(
      postId,
      communityId,
      post.authorId,
      res,
      summary.authorReceived,
    );

    return { closingSummary: summary };
  }

  private async sendNotifications(
    postId: string,
    communityId: string,
    authorId: string,
    result: HandlePostCloseResult,
    authorReceived: number,
  ): Promise<void> {
    const totalByInvestor = new Map<string, number>();
    for (const p of result.poolReturned) {
      totalByInvestor.set(
        p.investorId,
        (totalByInvestor.get(p.investorId) ?? 0) + p.amount,
      );
    }
    for (const d of result.ratingDistributed.investorDistributions) {
      totalByInvestor.set(
        d.investorId,
        (totalByInvestor.get(d.investorId) ?? 0) + d.amount,
      );
    }

    try {
      await Promise.all(
        Array.from(totalByInvestor.entries()).map(([invId, total]) =>
          this.notificationService.createNotification({
            userId: invId,
            type: 'post_closed_investment',
            source: 'system',
            metadata: { postId, communityId, totalEarnings: total },
            title: 'Post closed',
            message: `Post closed. Pool returned: ${result.poolReturned.find((p) => p.investorId === invId)?.amount ?? 0} merits. Your share of rating: ${result.ratingDistributed.investorDistributions.find((d) => d.investorId === invId)?.amount ?? 0} merits. Total received: ${total} merits`,
          }),
        ),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to create post_closed_investment notifications: ${err}`,
      );
    }

    if (authorReceived > 0) {
      try {
        await this.notificationService.createNotification({
          userId: authorId,
          type: 'post_closed',
          source: 'system',
          metadata: { postId, communityId, authorReceived },
          title: 'Post closed',
          message: `Post closed. You received: ${authorReceived} merits`,
        });
      } catch (err) {
        this.logger.warn(`Failed to create post_closed notification to author: ${err}`);
      }
    }
  }
}
