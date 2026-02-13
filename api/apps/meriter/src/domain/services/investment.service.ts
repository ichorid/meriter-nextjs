import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PublicationSchemaClass,
  PublicationDocument,
  type PublicationInvestment,
} from '../models/publication/publication.schema';
import { WalletService } from './wallet.service';
import { CommunityService } from './community.service';
import { NotificationService } from './notification.service';
import { UserService } from './user.service';

export interface ProcessInvestmentResult {
  postId: string;
  investorId: string;
  amount: number;
  investmentPool: number;
  investmentPoolTotal: number;
  investments: Array<{
    investorId: string;
    amount: number;
    sharePercent: number;
  }>;
}

export interface DistributeOnWithdrawalResult {
  authorAmount: number;
  investorDistributions: Array<{
    investorId: string;
    amount: number;
  }>;
}

export interface HandlePostCloseResult {
  poolReturned: Array<{ investorId: string; amount: number }>;
  ratingDistributed: DistributeOnWithdrawalResult;
  /** Total rating that was distributed (for reduceScore) */
  totalRatingDistributed: number;
}

/** C-3: Single investor entry in investment breakdown */
export interface InvestmentBreakdownInvestor {
  userId: string;
  username: string;
  avatarUrl?: string;
  amount: number;
  sharePercent: number;
  firstInvestDate: Date;
  lastInvestDate: Date;
}

/** C-3: Full investment breakdown for a post (public, for transparency) */
export interface InvestmentBreakdownResult {
  contractPercent: number;
  poolBalance: number;
  poolTotal: number;
  investorCount: number;
  investors: InvestmentBreakdownInvestor[];
  ttlDays: number | null;
  ttlExpiresAt: Date | null;
  stopLoss: number;
  noAuthorWalletSpend: boolean;
}

@Injectable()
export class InvestmentService {
  private readonly logger = new Logger(InvestmentService.name);

  constructor(
    @InjectModel(PublicationSchemaClass.name)
    private publicationModel: Model<PublicationDocument>,
    private walletService: WalletService,
    private communityService: CommunityService,
    private notificationService: NotificationService,
    private userService: UserService,
  ) {}

  /**
   * Process investment: deduct from investor wallet, add to post's investment pool.
   * Accumulates if investor already has a record.
   * C-2: Validates post exists, investingEnabled, not deleted, not author, wallet balance; wallet-only.
   */
  async processInvestment(
    postId: string,
    investorId: string,
    amount: number,
  ): Promise<ProcessInvestmentResult> {
    if (amount <= 0) {
      throw new BadRequestException('Investment amount must be greater than 0');
    }

    const post = await this.publicationModel.findOne({ id: postId }).lean().exec();
    if (!post) {
      throw new NotFoundException('Publication not found');
    }

    if (!post.investingEnabled) {
      throw new BadRequestException('This post does not accept investments');
    }

    if (post.deleted) {
      throw new BadRequestException('Cannot invest in a deleted post');
    }

    if (post.authorId === investorId) {
      throw new BadRequestException('Cannot invest in your own post');
    }

    const community = await this.communityService.getCommunity(post.communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    const currency = community.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };

    const wallet = await this.walletService.getWallet(investorId, post.communityId);
    const balance = wallet ? wallet.getBalance() : 0;
    if (balance < amount) {
      throw new BadRequestException(
        `Insufficient wallet balance. Available: ${balance}, Requested: ${amount}`,
      );
    }

    const investments = post.investments || [];
    const existingIndex = investments.findIndex(
      (inv: PublicationInvestment) => inv.investorId === investorId,
    );

    const now = new Date();
    let updatedInvestments: PublicationInvestment[];
    let addedAmount = amount;

    if (existingIndex >= 0) {
      const existing = investments[existingIndex];
      addedAmount = existing.amount + amount;
      updatedInvestments = [...investments];
      updatedInvestments[existingIndex] = {
        investorId: existing.investorId,
        amount: addedAmount,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
    } else {
      updatedInvestments = [
        ...investments,
        {
          investorId,
          amount,
          createdAt: now,
          updatedAt: now,
        },
      ];
    }

    const currentPool = post.investmentPool ?? 0;
    const currentTotal = post.investmentPoolTotal ?? 0;
    const newPool = currentPool + amount;
    const newTotal = currentTotal + amount;

    try {
      await this.walletService.addTransaction(
        investorId,
        post.communityId,
        'debit',
        amount,
        'personal',
        'investment',
        postId,
        currency,
        `Investment in post ${postId}`,
      );
    } catch (err) {
      this.logger.error(`Failed to deduct investment from wallet: ${err}`);
      throw err;
    }

    await this.publicationModel.updateOne(
      { id: postId },
      {
        $set: {
          investmentPool: newPool,
          investmentPoolTotal: newTotal,
          investments: updatedInvestments,
        },
      },
    );

    const totalInvested = updatedInvestments.reduce((sum, inv) => sum + inv.amount, 0);
    const resultInvestments = updatedInvestments.map((inv) => ({
      investorId: inv.investorId,
      amount: inv.amount,
      sharePercent: totalInvested > 0 ? (inv.amount / totalInvested) * 100 : 0,
    }));

    // C-10: Notify post author (new investment received)
    try {
      const investor = await this.userService.getUser(investorId);
      const investorName = investor?.displayName || 'Someone';
      await this.notificationService.createNotification({
        userId: post.authorId,
        type: 'investment_received',
        source: 'user',
        sourceId: investorId,
        metadata: { postId, communityId: post.communityId, investorId, amount },
        title: 'Investment received',
        message: `${investorName} invested ${amount} merits in your post`,
      });
    } catch (err) {
      this.logger.warn(`Failed to create investment_received notification: ${err}`);
    }

    return {
      postId,
      investorId,
      amount,
      investmentPool: newPool,
      investmentPoolTotal: newTotal,
      investments: resultInvestments,
    };
  }

  /**
   * Get investments for a post with share percentages
   */
  async getInvestmentsByPost(postId: string): Promise<
    Array<{
      investorId: string;
      amount: number;
      sharePercent: number;
    }>
  > {
    const post = await this.publicationModel.findOne({ id: postId }).lean().exec();
    if (!post) {
      throw new NotFoundException('Publication not found');
    }

    const investments = post.investments || [];
    const totalInvested = investments.reduce(
      (sum: number, inv: PublicationInvestment) => sum + inv.amount,
      0,
    );

    return investments.map((inv) => ({
      investorId: inv.investorId,
      amount: inv.amount,
      sharePercent:
        totalInvested > 0 ? (inv.amount / totalInvested) * 100 : 0,
    }));
  }

  /**
   * C-3: Get full investment breakdown for a post (public).
   * Returns contract, pool stats, per-investor list with user info and dates.
   */
  async getInvestmentBreakdown(
    postId: string,
  ): Promise<InvestmentBreakdownResult> {
    const post = await this.publicationModel.findOne({ id: postId }).lean().exec();
    if (!post) {
      throw new NotFoundException('Publication not found');
    }

    const investments = post.investments || [];
    const totalInvested = investments.reduce(
      (sum: number, inv: PublicationInvestment) => sum + inv.amount,
      0,
    );

    const investors: InvestmentBreakdownInvestor[] = await Promise.all(
      investments.map(async (inv: PublicationInvestment) => {
        const user = await this.userService.getUserById(inv.investorId);
        const sharePercent =
          totalInvested > 0 ? (inv.amount / totalInvested) * 100 : 0;
        return {
          userId: inv.investorId,
          username: user?.displayName ?? 'Unknown',
          avatarUrl: user?.avatarUrl,
          amount: inv.amount,
          sharePercent,
          firstInvestDate: inv.createdAt,
          lastInvestDate: inv.updatedAt,
        };
      }),
    );

    return {
      contractPercent: post.investorSharePercent ?? 0,
      poolBalance: post.investmentPool ?? 0,
      poolTotal: post.investmentPoolTotal ?? 0,
      investorCount: investors.length,
      investors,
      ttlDays: post.ttlDays ?? null,
      ttlExpiresAt: post.ttlExpiresAt ?? null,
      stopLoss: post.stopLoss ?? 0,
      noAuthorWalletSpend: post.noAuthorWalletSpend ?? false,
    };
  }

  /**
   * Get all investments by a user (for portfolio)
   */
  async getInvestmentsByUser(userId: string): Promise<
    Array<{
      postId: string;
      amount: number;
      sharePercent: number;
      investmentPool: number;
      investmentPoolTotal: number;
    }>
  > {
    const posts = await this.publicationModel
      .find({
        'investments.investorId': userId,
        deleted: { $ne: true },
      })
      .lean()
      .exec();

    return posts.map((post) => {
      const inv = post.investments?.find(
        (i: PublicationInvestment) => i.investorId === userId,
      );
      const totalInvested = (post.investments || []).reduce(
        (sum: number, i: PublicationInvestment) => sum + i.amount,
        0,
      );
      return {
        postId: post.id,
        amount: inv?.amount ?? 0,
        sharePercent:
          totalInvested > 0 && inv
            ? (inv.amount / totalInvested) * 100
            : 0,
        investmentPool: post.investmentPool ?? 0,
        investmentPoolTotal: post.investmentPoolTotal ?? 0,
      };
    });
  }

  /**
   * Distribute merits on withdrawal: X% to investors, rest to author.
   * C-4: Round investor shares to 0.01; any remainder goes to author.
   * Follows business-investing.mdc strictly.
   */
  async distributeOnWithdrawal(
    postId: string,
    withdrawAmount: number,
  ): Promise<DistributeOnWithdrawalResult> {
    const post = await this.publicationModel.findOne({ id: postId }).lean().exec();
    if (!post) {
      throw new NotFoundException('Publication not found');
    }

    const investments = post.investments || [];
    if (investments.length === 0) {
      return {
        authorAmount: withdrawAmount,
        investorDistributions: [],
      };
    }

    const investorSharePercent = post.investorSharePercent ?? 0;
    const totalInvested = investments.reduce(
      (sum: number, inv: PublicationInvestment) => sum + inv.amount,
      0,
    );
    if (totalInvested <= 0) {
      return {
        authorAmount: withdrawAmount,
        investorDistributions: [],
      };
    }

    // investorTotal = amount * contractPercent / 100, rounded to 0.01
    const investorTotal = this.roundToHundredths(
      withdrawAmount * (investorSharePercent / 100),
    );

    const community = await this.communityService.getCommunity(post.communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    const currency = community.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };

    // Per investor: share = investorTotal * (investor.amount / totalInvested), round to 0.01
    const investorDistributions: Array<{ investorId: string; amount: number }> = [];
    let distributedTotal = 0;

    for (const inv of investments) {
      const share = investorTotal * (inv.amount / totalInvested);
      const amount = this.roundToHundredths(share);
      distributedTotal += amount;
      if (amount > 0) {
        investorDistributions.push({
          investorId: inv.investorId,
          amount,
        });
      }
    }

    // Remainder from rounding goes to author (C-4)
    const authorAmount = withdrawAmount - distributedTotal;

    for (const dist of investorDistributions) {
      await this.walletService.addTransaction(
        dist.investorId,
        post.communityId,
        'credit',
        dist.amount,
        'personal',
        'investment_distribution',
        postId,
        currency,
        `Investment distribution from post ${postId}`,
      );
    }

    // C-10: Notify each investor (withdrawal distribution; only those with amount > 0)
    try {
      const author = await this.userService.getUser(post.authorId);
      const authorName = author?.displayName || 'Author';
      await Promise.all(
        investorDistributions.map((dist) =>
          this.notificationService.createNotification({
            userId: dist.investorId,
            type: 'investment_distributed',
            source: 'user',
            sourceId: post.authorId,
            metadata: {
              postId,
              communityId: post.communityId,
              withdrawAmount,
              amount: dist.amount,
            },
            title: 'Investment distributed',
            message: `${authorName} withdrew ${withdrawAmount} merits from post. Your share: ${dist.amount} merits`,
          }),
        ),
      );
    } catch (err) {
      this.logger.warn(`Failed to create investment_distributed notifications: ${err}`);
    }

    return {
      authorAmount,
      investorDistributions,
    };
  }

  /** Round to 2 decimal places (0.01). Used for merit distribution. */
  private roundToHundredths(x: number): number {
    return Math.round(x * 100) / 100;
  }

  /**
   * Handle post close: return unspent pool to investors, then auto-withdraw rating.
   */
  async handlePostClose(postId: string): Promise<HandlePostCloseResult> {
    const post = await this.publicationModel.findOne({ id: postId }).lean().exec();
    if (!post) {
      throw new NotFoundException('Publication not found');
    }

    const poolReturned: Array<{ investorId: string; amount: number }> = [];
    let ratingDistributed: DistributeOnWithdrawalResult = {
      authorAmount: 0,
      investorDistributions: [],
    };
    let totalRatingDistributed = 0;

    const investments = post.investments || [];
    const currentPool = post.investmentPool ?? 0;
    const totalInvested = investments.reduce(
      (sum: number, inv: PublicationInvestment) => sum + inv.amount,
      0,
    );

    if (investments.length > 0 && currentPool > 0 && totalInvested > 0) {
      const community = await this.communityService.getCommunity(post.communityId);
      if (community) {
        const currency = community.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        };

        let returnedTotal = 0;
        for (let i = 0; i < investments.length; i++) {
          const inv = investments[i];
          const share = (inv.amount / totalInvested) * currentPool;
          const amount = Math.floor(share);
          returnedTotal += amount;
          if (amount > 0) {
            poolReturned.push({ investorId: inv.investorId, amount });
            await this.walletService.addTransaction(
              inv.investorId,
              post.communityId,
              'credit',
              amount,
              'personal',
              'investment_pool_return',
              postId,
              currency,
              `Investment pool return from closed post ${postId}`,
            );
          }
        }
        const remainder = currentPool - returnedTotal;
        if (remainder > 0 && poolReturned.length > 0) {
          poolReturned[0].amount += remainder;
          await this.walletService.addTransaction(
            poolReturned[0].investorId,
            post.communityId,
            'credit',
            remainder,
            'personal',
            'investment_pool_return',
            postId,
            currency,
            `Investment pool return (remainder) from closed post ${postId}`,
          );
        }

        await this.publicationModel.updateOne(
          { id: postId },
          { $set: { investmentPool: 0 } },
        );
      }
    }

    const currentScore = post.metrics?.score ?? 0;
    if (currentScore > 0 && investments.length > 0) {
      ratingDistributed = await this.distributeOnWithdrawal(postId, currentScore);
      totalRatingDistributed = currentScore;
    } else if (currentScore > 0 && investments.length === 0) {
      ratingDistributed = {
        authorAmount: currentScore,
        investorDistributions: [],
      };
      totalRatingDistributed = currentScore;
    }

    // Notify each investor: POST_CLOSED_INVESTMENT (total earnings = pool return + rating distribution)
    if (investments.length > 0) {
      try {
        const totalByInvestor = new Map<string, number>();
        for (const p of poolReturned) {
          totalByInvestor.set(p.investorId, (totalByInvestor.get(p.investorId) ?? 0) + p.amount);
        }
        for (const d of ratingDistributed.investorDistributions) {
          totalByInvestor.set(d.investorId, (totalByInvestor.get(d.investorId) ?? 0) + d.amount);
        }
        await Promise.all(
          Array.from(totalByInvestor.entries()).map(([invId, total]) =>
            this.notificationService.createNotification({
              userId: invId,
              type: 'post_closed_investment',
              source: 'system',
              metadata: { postId, communityId: post.communityId, totalEarnings: total },
              title: 'Post closed',
              message: `Post closed. Your total earnings: ${total} merits`,
            }),
          ),
        );
      } catch (err) {
        this.logger.warn(`Failed to create post_closed_investment notifications: ${err}`);
      }
    }

    return {
      poolReturned,
      ratingDistributed,
      totalRatingDistributed,
    };
  }
}
