import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
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

/** F-2: Portfolio list item (one post where user is investor). */
export interface MyPortfolioItem {
  postId: string;
  postTitle: string;
  postAuthor: { name: string; avatarUrl?: string };
  communityName: string;
  investedAmount: number;
  sharePercent: number;
  totalEarnings: number;
  postStatus: 'active' | 'closed';
  postRating: number;
  investmentPool: number;
  ttlExpiresAt: Date | null;
  lastWithdrawalDate: Date | null;
}

/** F-2: Aggregated stats for portfolio. */
export interface MyPortfolioStats {
  totalInvested: number;
  totalEarned: number;
  sroi: number;
  activeCount: number;
  closedCount: number;
}

/** F-2: Options for getMyPortfolio. */
export interface GetMyPortfolioOptions {
  sort: 'date' | 'amount' | 'earnings';
  filter: 'all' | 'active' | 'closed';
  page: number;
  limit: number;
}

/** F-2: Full portfolio response. */
export interface GetMyPortfolioResult {
  stats: MyPortfolioStats;
  items: MyPortfolioItem[];
  totalCount: number;
}

/** F-3: Investment details (single post) for current investor. */
export interface InvestmentDetailsResult {
  postId: string;
  title: string;
  authorId: string;
  communityId: string;
  status: 'active' | 'closed';
  earningsHistory: Array<{
    amount: number;
    date: string;
    reason: 'withdrawal' | 'pool_return' | 'close';
  }>;
  contractPercent: number;
  ttlDays: number | null;
  ttlExpiresAt: Date | null;
  stopLoss: number;
  noAuthorWalletSpend: boolean;
  rating: number;
  investmentPool: number;
  closingSummary: {
    totalEarned: number;
    distributedToInvestors: number;
    authorReceived: number;
    spentOnShows: number;
    poolReturned: number;
  } | null;
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

    if ((post.status ?? 'active') === 'closed') {
      throw new BadRequestException(
        'This post is closed and cannot be modified',
      );
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
        totalEarnings: existing.totalEarnings ?? 0,
        earningsHistory: existing.earningsHistory ?? [],
      };
    } else {
      updatedInvestments = [
        ...investments,
        {
          investorId,
          amount,
          createdAt: now,
          updatedAt: now,
          totalEarnings: 0,
          earningsHistory: [],
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
   * F-2: Get current user's investment portfolio with stats and paginated list.
   * Uses aggregation for efficiency; enriches with author and community names.
   */
  async getMyPortfolio(
    userId: string,
    options: GetMyPortfolioOptions,
  ): Promise<GetMyPortfolioResult> {
    const filterMatch =
      options.filter === 'all' ? {} : { status: options.filter };
    const skip = (options.page - 1) * options.limit;
    const sortKey =
      options.sort === 'date'
        ? 'myInv.createdAt'
        : options.sort === 'amount'
          ? 'myInv.amount'
          : 'myInv.totalEarnings';

    const pipeline: Record<string, unknown>[] = [
      {
        $match: {
          'investments.investorId': userId,
          deleted: { $ne: true },
          ...filterMatch,
        },
      },
      {
        $addFields: {
          myInv: {
            $arrayElemAt: [
              {
                $filter: {
                  input: '$investments',
                  as: 'i',
                  cond: { $eq: ['$$i.investorId', userId] },
                },
              },
              0,
            ],
          },
        },
      },
      { $match: { myInv: { $ne: null } } },
      {
        $facet: {
          stats: [
            {
              $group: {
                _id: null,
                totalInvested: { $sum: '$myInv.amount' },
                totalEarned: { $sum: { $ifNull: ['$myInv.totalEarnings', 0] } },
                activeCount: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'active'] }, 1, 0],
                  },
                },
                closedCount: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'closed'] }, 1, 0],
                  },
                },
              },
            },
          ],
          totalCount: [{ $count: 'total' }],
          items: [
            { $sort: { [sortKey]: -1 } },
            { $skip: skip },
            { $limit: options.limit },
            {
              $project: {
                id: 1,
                title: 1,
                authorId: 1,
                communityId: 1,
                status: 1,
                'metrics.score': 1,
                investmentPool: 1,
                investmentPoolTotal: 1,
                ttlExpiresAt: 1,
                closingSummary: 1,
                myInv: 1,
              },
            },
          ],
        },
      },
    ];

    const result = await this.publicationModel
      .aggregate<{
        stats: Array<{
          totalInvested: number;
          totalEarned: number;
          activeCount: number;
          closedCount: number;
        }>;
        totalCount: Array<{ total: number }>;
        items: Array<{
          id: string;
          title?: string;
          authorId: string;
          communityId: string;
          status?: 'active' | 'closed';
          metrics?: { score?: number };
          investmentPool?: number;
          investmentPoolTotal?: number;
          ttlExpiresAt?: Date | null;
          closingSummary?: unknown;
          myInv: PublicationInvestment;
        }>;
      }>(pipeline)
      .exec();

    const facet = result[0];
    const statsRow = facet?.stats?.[0];
    const totalInvested = statsRow?.totalInvested ?? 0;
    const totalEarned = statsRow?.totalEarned ?? 0;
    const activeCount = statsRow?.activeCount ?? 0;
    const closedCount = statsRow?.closedCount ?? 0;
    const sroi =
      totalInvested > 0
        ? ((totalEarned - totalInvested) / totalInvested) * 100
        : 0;
    const totalCount = facet?.totalCount?.[0]?.total ?? 0;
    const rawItems = facet?.items ?? [];

    const authorIds = [...new Set(rawItems.map((d) => d.authorId))];
    const communityIds = [...new Set(rawItems.map((d) => d.communityId))];
    const [authors, communities] = await Promise.all([
      Promise.all(authorIds.map((id) => this.userService.getUserById(id))),
      Promise.all(
        communityIds.map((id) => this.communityService.getCommunity(id)),
      ),
    ]);
    const authorMap = new Map(
      authorIds.map((id, i) => [id, authors[i] ?? null]),
    );
    const communityMap = new Map(
      communityIds.map((id, i) => [id, communities[i] ?? null]),
    );

    const items: MyPortfolioItem[] = rawItems.map((d) => {
      const myInv = d.myInv;
      const poolTotal = d.investmentPoolTotal ?? 0;
      const sharePercent =
        poolTotal > 0 ? (myInv.amount / poolTotal) * 100 : 0;
      const lastWithdrawal =
        myInv.earningsHistory?.filter((e) => e.reason === 'withdrawal').pop();
      const author = authorMap.get(d.authorId);
      const community = communityMap.get(d.communityId);
      return {
        postId: d.id,
        postTitle: d.title ?? '',
        postAuthor: {
          name: author?.displayName ?? 'Unknown',
          avatarUrl: author?.avatarUrl,
        },
        communityName: community?.name ?? 'Community',
        investedAmount: myInv.amount,
        sharePercent,
        totalEarnings: myInv.totalEarnings ?? 0,
        postStatus: d.status ?? 'active',
        postRating: d.metrics?.score ?? 0,
        investmentPool: d.investmentPool ?? 0,
        ttlExpiresAt: d.ttlExpiresAt ?? null,
        lastWithdrawalDate: lastWithdrawal?.date ?? null,
      };
    });

    return {
      stats: {
        totalInvested,
        totalEarned,
        sroi,
        activeCount,
        closedCount,
      },
      items,
      totalCount,
    };
  }

  /**
   * F-3: Get full investment details for one post (current user must be investor).
   */
  async getInvestmentDetails(
    userId: string,
    postId: string,
  ): Promise<InvestmentDetailsResult> {
    const post = await this.publicationModel
      .findOne({ id: postId })
      .lean()
      .exec();
    if (!post) {
      throw new NotFoundException('Publication not found');
    }
    const myInv = post.investments?.find(
      (i: PublicationInvestment) => i.investorId === userId,
    );
    if (!myInv) {
      throw new NotFoundException(
        'You are not an investor in this post, or post not found',
      );
    }

    const earningsHistory = (myInv.earningsHistory ?? []).map((e) => ({
      amount: e.amount,
      date: typeof e.date === 'string' ? e.date : e.date.toISOString(),
      reason: e.reason,
    }));

    return {
      postId: post.id,
      title: post.title ?? '',
      authorId: post.authorId,
      communityId: post.communityId,
      status: (post.status as 'active' | 'closed') ?? 'active',
      earningsHistory,
      contractPercent: post.investorSharePercent ?? 0,
      ttlDays: post.ttlDays ?? null,
      ttlExpiresAt: post.ttlExpiresAt ?? null,
      stopLoss: post.stopLoss ?? 0,
      noAuthorWalletSpend: post.noAuthorWalletSpend ?? false,
      rating: post.metrics?.score ?? 0,
      investmentPool: post.investmentPool ?? 0,
      closingSummary: post.closingSummary ?? null,
    };
  }

  /**
   * Distribute merits on withdrawal: X% to investors, rest to author.
   * C-4: Round investor shares to 0.01; any remainder goes to author.
   * Follows business-investing.mdc strictly.
   * When session is provided (transaction), notifications are skipped (caller notifies after commit).
   * F-1: Records totalEarnings and earningsHistory per investor; earningsReason defaults to 'withdrawal', use 'close' when called from handlePostClose.
   */
  async distributeOnWithdrawal(
    postId: string,
    withdrawAmount: number,
    session?: ClientSession,
    earningsReason: 'withdrawal' | 'close' = 'withdrawal',
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
        session,
      );
    }

    // F-1: Update per-investor totalEarnings and earningsHistory
    const updateOptions = session ? { session } : {};
    await Promise.all(
      investorDistributions.map((dist) =>
        this.publicationModel.updateOne(
          { id: postId, 'investments.investorId': dist.investorId },
          {
            $inc: { 'investments.$.totalEarnings': dist.amount },
            $push: {
              'investments.$.earningsHistory': {
                amount: dist.amount,
                date: new Date(),
                reason: earningsReason,
              },
            },
          },
          updateOptions,
        ),
      ),
    );

    // C-10: Notify each investor (skip when inside transaction; caller notifies after commit)
    if (!session) {
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
        this.logger.warn(
          `Failed to create investment_distributed notifications: ${err}`,
        );
      }
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
   * When session is provided (transaction), all writes use it and investor notifications are skipped.
   */
  async handlePostClose(
    postId: string,
    session?: ClientSession,
  ): Promise<HandlePostCloseResult> {
    const query = this.publicationModel.findOne({ id: postId });
    if (session) query.session(session);
    const post = await query.lean().exec();
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
              session,
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
            session,
          );
        }

        await this.publicationModel.updateOne(
          { id: postId },
          { $set: { investmentPool: 0 } },
          session ? { session } : {},
        );

        // F-1: Record pool_return in each investor's totalEarnings and earningsHistory
        const updateOpts = session ? { session } : {};
        await Promise.all(
          poolReturned.map((p) =>
            this.publicationModel.updateOne(
              { id: postId, 'investments.investorId': p.investorId },
              {
                $inc: { 'investments.$.totalEarnings': p.amount },
                $push: {
                  'investments.$.earningsHistory': {
                    amount: p.amount,
                    date: new Date(),
                    reason: 'pool_return' as const,
                  },
                },
              },
              updateOpts,
            ),
          ),
        );
      }
    }

    const currentScore = post.metrics?.score ?? 0;
    if (currentScore > 0 && investments.length > 0) {
      ratingDistributed = await this.distributeOnWithdrawal(
        postId,
        currentScore,
        session,
        'close',
      );
      totalRatingDistributed = currentScore;
    } else if (currentScore > 0 && investments.length === 0) {
      ratingDistributed = {
        authorAmount: currentScore,
        investorDistributions: [],
      };
      totalRatingDistributed = currentScore;
    }

    // Notify each investor when not in transaction (caller sends after commit when session provided)
    if (investments.length > 0 && !session) {
      try {
        const totalByInvestor = new Map<string, number>();
        for (const p of poolReturned) {
          totalByInvestor.set(
            p.investorId,
            (totalByInvestor.get(p.investorId) ?? 0) + p.amount,
          );
        }
        for (const d of ratingDistributed.investorDistributions) {
          totalByInvestor.set(
            d.investorId,
            (totalByInvestor.get(d.investorId) ?? 0) + d.amount,
          );
        }
        await Promise.all(
          Array.from(totalByInvestor.entries()).map(([invId, total]) =>
            this.notificationService.createNotification({
              userId: invId,
              type: 'post_closed_investment',
              source: 'system',
              metadata: {
                postId,
                communityId: post.communityId,
                totalEarnings: total,
              },
              title: 'Post closed',
              message: `Post closed. Your total earnings: ${total} merits`,
            }),
          ),
        );
      } catch (err) {
        this.logger.warn(
          `Failed to create post_closed_investment notifications: ${err}`,
        );
      }
    }

    return {
      poolReturned,
      ratingDistributed,
      totalRatingDistributed,
    };
  }
}
