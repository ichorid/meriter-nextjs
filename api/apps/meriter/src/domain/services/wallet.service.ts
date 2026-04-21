import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, ClientSession } from 'mongoose';
import { Wallet } from '../aggregates/wallet/wallet.entity';
import { WalletSchemaClass, WalletDocument } from '../models/wallet/wallet.schema';
import { Transaction, TransactionSchemaClass, TransactionDocument } from '../models/transaction/transaction.schema';
import { UserId, CommunityId } from '../value-objects';
import { WalletBalanceChangedEvent } from '../events';
import { EventBus } from '../events/event-bus';
import { uid } from 'uid';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';
import { WalletDocument as IWalletDocument } from '../../common/interfaces/wallet-document.interface';
import {
  MERIT_HISTORY_FILTER_KEYS,
  buildMeritHistoryTransactionMatch,
  meritHistoryCategoryMongoExprOnRtVar,
  meritHistorySignedAmountMongoExpr,
  meritHistoryUtcCalendarRange,
  type MeritHistoryDashboardPeriodDays,
  type MeritHistoryFilterKey,
} from '../common/helpers/wallet-transaction-history';

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

export type MeritHistoryDashboardKpis = {
  inflow: number;
  outflow: number;
  net: number;
  count: number;
};

export type MeritHistoryDashboardSeriesPoint = { date: string; net: number };

export type MeritHistoryDashboardBreakdownRow = {
  category: Exclude<MeritHistoryFilterKey, 'all'>;
  net: number;
  grossVolume: number;
  count: number;
};

export type MeritHistoryDashboardResult = {
  kpis: MeritHistoryDashboardKpis;
  series: MeritHistoryDashboardSeriesPoint[];
  breakdown?: MeritHistoryDashboardBreakdownRow[];
};

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectModel(WalletSchemaClass.name) private walletModel: Model<WalletDocument>,
    @InjectModel(TransactionSchemaClass.name) private transactionModel: Model<TransactionDocument>,
    @InjectConnection() private mongoose: Connection,
    private eventBus: EventBus,
  ) {}

  async startSession() {
    return await this.mongoose.startSession();
  }

  async getWallet(userId: string, communityId: string): Promise<Wallet | null> {
    // Direct Mongoose - no repository wrapper needed
    const doc = await this.walletModel
      .findOne({ userId, communityId })
      .lean()
      .exec();
    
    return doc ? Wallet.fromSnapshot(doc as IWalletDocument) : null;
  }

  async createOrGetWallet(
    userId: string,
    communityId: string,
    currency: { singular: string; plural: string; genitive: string },
    options?: { startingMeritsIfNewWallet?: number },
  ): Promise<Wallet> {
    let wallet = await this.getWallet(userId, communityId);
    const wasNew = !wallet;

    if (!wallet) {
      wallet = Wallet.create(
        UserId.fromString(userId),
        CommunityId.fromString(communityId),
        currency,
      );

      await this.walletModel.create(wallet.toSnapshot());
    }

    const start =
      wasNew &&
      communityId !== GLOBAL_COMMUNITY_ID &&
      typeof options?.startingMeritsIfNewWallet === 'number'
        ? options.startingMeritsIfNewWallet
        : 0;

    if (start > 0) {
      const walletId = wallet.getId.getValue();
      const already = await this.transactionModel
        .findOne({ walletId, referenceType: 'community_starting_merits' })
        .lean()
        .exec();
      if (!already) {
        return this.addTransaction(
          userId,
          communityId,
          'credit',
          start,
          'personal',
          'community_starting_merits',
          communityId,
          currency,
          'Community starting merits',
        );
      }
    }

    return wallet;
  }

  async addTransaction(
    userId: string,
    communityId: string,
    type: 'credit' | 'debit',
    amount: number,
    sourceType: 'personal' | 'quota',
    referenceType: string,
    referenceId: string,
    currency: { singular: string; plural: string; genitive: string },
    description?: string,
    session?: ClientSession,
  ): Promise<Wallet> {
    const opts = session ? { session } : {};
    // Get or create wallet
    let wallet = await this.getWallet(userId, communityId);
    const isNewWallet = !wallet;

    if (!wallet) {
      wallet = Wallet.create(
        UserId.fromString(userId),
        CommunityId.fromString(communityId),
        currency,
      );
    }

    // Domain logic
    if (type === 'credit') {
      wallet.add(amount);
    } else {
      wallet.deduct(amount);
    }

    // Save wallet - use create for new wallets, updateOne for existing ones
    const walletSnapshot = wallet.toSnapshot();
    if (isNewWallet) {
      await this.walletModel.create([walletSnapshot], opts);
    } else {
      await this.walletModel.updateOne(
        { id: walletSnapshot.id },
        { $set: walletSnapshot },
        opts,
      );
    }

    // Map transaction type: credit -> deposit/withdrawal, debit -> withdrawal
    // The actual transaction type depends on referenceType (e.g., 'publication_withdrawal' -> 'withdrawal')
    let transactionType: 'vote' | 'comment' | 'poll_cast' | 'withdrawal' | 'deposit';
    if (referenceType === 'publication_withdrawal' || referenceType === 'comment_withdrawal') {
      transactionType = 'withdrawal';
    } else if (referenceType === 'vote' || referenceType === 'publication_vote' || referenceType === 'comment_vote') {
      transactionType = 'vote';
    } else if (referenceType === 'comment') {
      transactionType = 'comment';
    } else if (referenceType === 'poll_cast') {
      transactionType = 'poll_cast';
    } else if (type === 'credit') {
      transactionType = 'deposit';
    } else {
      transactionType = 'withdrawal';
    }
    
    // Create transaction record
    await this.transactionModel.create(
      [
        {
          id: uid(),
          walletId: wallet.getId.getValue(),
          type: transactionType,
          amount: Math.abs(amount), // Always positive for transaction record
          description:
            description ||
            `${transactionType} ${referenceType ? `(${referenceType})` : ''}`,
          referenceType,
          referenceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      opts,
    );

    // Publish event
    await this.eventBus.publish(
      new WalletBalanceChangedEvent(
        wallet.getId.getValue(),
        userId,
        communityId,
        amount,
        type
      )
    );

    return wallet;
  }

  async getTransactions(walletId: string, limit: number = 50, skip: number = 0): Promise<Transaction[]> {
    // Direct Mongoose query
    const transactions = await this.transactionModel
      .find({ walletId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean();
    
    return transactions as unknown as Transaction[];
  }

  async getUserWallet(userId: string, communityId: string): Promise<Wallet | null> {
    return this.getWallet(userId, communityId);
  }

  /**
   * Removes the user's wallet for a non-global community and its transaction rows (merits forfeited on leave).
   */
  async removeUserWalletAndTransactionsForCommunity(
    userId: string,
    communityId: string,
  ): Promise<void> {
    if (communityId === GLOBAL_COMMUNITY_ID) {
      throw new BadRequestException('Cannot remove global wallet');
    }
    const wallet = await this.getWallet(userId, communityId);
    if (!wallet) {
      return;
    }
    const walletId = wallet.getId.getValue();
    await this.transactionModel.deleteMany({ walletId });
    await this.walletModel.deleteOne({ id: walletId });
  }

  async getUserWallets(userId: string): Promise<Wallet[]> {
    const docs = await this.walletModel
      .find({ userId })
      .lean()
      .exec();
    
    return docs.map(doc => Wallet.fromSnapshot(doc as IWalletDocument));
  }

  async createTransaction(
    walletId: string,
    type: string,
    amount: number,
    description: string,
    referenceType?: string,
    referenceId?: string,
  ): Promise<any> {
    // This is a simplified implementation
    // In reality, you'd create a transaction document
    return {
      id: uid(),
      walletId,
      type,
      amount,
      description,
      referenceType,
      referenceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getTransaction(_id: string): Promise<any> {
    // This is a simplified implementation
    return null;
  }

  async getTransactionByReference(
    _type: string,
    _referenceId: string,
    _userId: string,
  ): Promise<any> {
    // This is a simplified implementation
    return null;
  }

  async getTransactionsByReference(
    _type: string,
    _referenceId: string,
    _limit: number,
    _skip: number,
  ): Promise<any[]> {
    // This is a simplified implementation
    return [];
  }

  /**
   * Paginated wallet transaction rows for Merit History (default: global wallet).
   * @param _legacyType reserved for older callers — ignored
   */
  async getUserTransactions(
    userId: string,
    _legacyType: string,
    limit: number,
    skip: number,
    options?: {
      communityId?: string;
      category?: MeritHistoryFilterKey;
    },
  ): Promise<{ data: Transaction[]; total: number }> {
    const communityId = options?.communityId ?? GLOBAL_COMMUNITY_ID;
    const category = options?.category ?? 'all';

    const wallet = await this.getWallet(userId, communityId);
    if (!wallet) {
      return { data: [], total: 0 };
    }

    const walletId = wallet.getId.getValue();
    const filter = buildMeritHistoryTransactionMatch(walletId, category);

    const [total, rows] = await Promise.all([
      this.transactionModel.countDocuments(filter),
      this.transactionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    return { data: rows as unknown as Transaction[], total };
  }

  async deleteTransaction(_id: string): Promise<void> {
    // This is a simplified implementation
  }

  /**
   * Credit welcome merits to global wallet on first registration.
   * Idempotent: does nothing if user already received welcome merits.
   * @param amount Amount to credit (from platform settings; 0 = no-op).
   */
  async creditWelcomeMeritsIfNeeded(userId: string, amount: number): Promise<boolean> {
    if (amount <= 0) return false;
    const wallet = await this.createOrGetWallet(
      userId,
      GLOBAL_COMMUNITY_ID,
      DEFAULT_CURRENCY,
    );
    const walletId = wallet.getId.getValue();
    const existing = await this.transactionModel
      .findOne({ walletId, referenceType: 'welcome_merits' })
      .lean()
      .exec();
    if (existing) {
      return false;
    }
    await this.addTransaction(
      userId,
      GLOBAL_COMMUNITY_ID,
      'credit',
      amount,
      'personal',
      'welcome_merits',
      userId,
      DEFAULT_CURRENCY,
      'Welcome merits at registration',
    );
    this.logger.log(`Credited ${amount} welcome merits to user ${userId}`);
    return true;
  }

  /**
   * Returns total withdrawn amount for a reference (e.g., comment/publication) via wallet transactions.
   * Aggregates by referenceType and referenceId to avoid N+1.
   */
  async getTotalWithdrawnByReference(referenceType: string, referenceId: string): Promise<number> {
    const result = await this.transactionModel.aggregate([
      { $match: { referenceType, referenceId, type: 'withdrawal' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).exec();
    return (result && result[0] && result[0].total) || 0;
  }

  /**
   * Sum investor-bucket project payout credits to the user's global wallet, per project (for portfolio backfill).
   */
  async sumProjectInvestorPayoutCreditsByProjects(
    userId: string,
    projectIds: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (projectIds.length === 0) return result;
    const wallet = await this.walletModel
      .findOne({ userId, communityId: GLOBAL_COMMUNITY_ID })
      .select('id')
      .lean()
      .exec();
    if (!wallet?.id) return result;
    const rows = await this.transactionModel
      .aggregate<{ _id: string; sum: number }>([
        {
          $match: {
            walletId: wallet.id,
            type: 'deposit',
            referenceType: 'project_payout',
            referenceId: { $in: projectIds },
            description: { $regex: /\(investor\)\s*$/ },
          },
        },
        { $group: { _id: '$referenceId', sum: { $sum: '$amount' } } },
      ])
      .exec();
    for (const r of rows) {
      if (r._id) result.set(r._id, r.sum);
    }
    return result;
  }

  /**
   * KPIs, daily signed net, and optional per-bucket breakdown for the merit-history dashboard.
   * Same wallet scope as `getUserTransactions` (global wallet by default).
   */
  async getMeritHistoryDashboard(
    userId: string,
    category: MeritHistoryFilterKey,
    periodDays: MeritHistoryDashboardPeriodDays,
    options?: { communityId?: string },
  ): Promise<MeritHistoryDashboardResult> {
    const emptyKpis: MeritHistoryDashboardKpis = {
      inflow: 0,
      outflow: 0,
      net: 0,
      count: 0,
    };
    const communityId = options?.communityId ?? GLOBAL_COMMUNITY_ID;
    const wallet = await this.getWallet(userId, communityId);
    if (!wallet) {
      return { kpis: emptyKpis, series: [] };
    }

    const walletId = wallet.getId.getValue();
    const range =
      periodDays === 'all' ? undefined : meritHistoryUtcCalendarRange(periodDays);
    const match = buildMeritHistoryTransactionMatch(walletId, category, range);
    const signedExpr = meritHistorySignedAmountMongoExpr();

    const roundMerits = (n: number) => Math.round(n * 100) / 100;

    const [facetRow] = await this.transactionModel
      .aggregate<{
        summary: Array<{
          inflow: number;
          outflow: number;
          net: number;
          count: number;
        }>;
        byDay: Array<{ _id: string; net: number }>;
      }>([
        { $match: match },
        { $addFields: { _signed: signedExpr } },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  inflow: {
                    $sum: { $cond: [{ $gt: ['$_signed', 0] }, '$_signed', 0] },
                  },
                  outflow: {
                    $sum: {
                      $cond: [
                        { $lt: ['$_signed', 0] },
                        { $multiply: ['$_signed', -1] },
                        0,
                      ],
                    },
                  },
                  net: { $sum: '$_signed' },
                  count: { $sum: 1 },
                },
              },
            ],
            byDay: [
              {
                $addFields: {
                  _day: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$createdAt',
                      timezone: 'UTC',
                    },
                  },
                },
              },
              { $group: { _id: '$_day', net: { $sum: '$_signed' } } },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ])
      .exec();

    const summary = facetRow?.summary?.[0];
    const kpis: MeritHistoryDashboardKpis = summary
      ? {
          inflow: roundMerits(summary.inflow ?? 0),
          outflow: roundMerits(summary.outflow ?? 0),
          net: roundMerits(summary.net ?? 0),
          count: Math.trunc(summary.count ?? 0),
        }
      : emptyKpis;

    const series: MeritHistoryDashboardSeriesPoint[] = (facetRow?.byDay ?? []).map((d) => ({
      date: d._id,
      net: roundMerits(d.net ?? 0),
    }));

    let breakdown: MeritHistoryDashboardBreakdownRow[] | undefined;
    if (category === 'all') {
      const allMatch = buildMeritHistoryTransactionMatch(walletId, 'all', range);
      const catExpr = meritHistoryCategoryMongoExprOnRtVar();
      const rows = await this.transactionModel
        .aggregate<{
          _id: string;
          net: number;
          inPos: number;
          outNeg: number;
          count: number;
        }>([
          { $match: allMatch },
          { $addFields: { _signed: signedExpr } },
          { $addFields: { _bucket: catExpr } },
          {
            $group: {
              _id: '$_bucket',
              net: { $sum: '$_signed' },
              inPos: {
                $sum: { $cond: [{ $gt: ['$_signed', 0] }, '$_signed', 0] },
              },
              outNeg: {
                $sum: {
                  $cond: [
                    { $lt: ['$_signed', 0] },
                    { $multiply: ['$_signed', -1] },
                    0,
                  ],
                },
              },
              count: { $sum: 1 },
            },
          },
        ])
        .exec();

      const byCat = new Map(rows.map((r) => [r._id, r]));
      const ordered: MeritHistoryDashboardBreakdownRow[] = [];
      for (const key of MERIT_HISTORY_FILTER_KEYS) {
        if (key === 'all') continue;
        const r = byCat.get(key);
        const net = roundMerits(r?.net ?? 0);
        const inPos = r?.inPos ?? 0;
        const outNeg = r?.outNeg ?? 0;
        const grossVolume = roundMerits(inPos + outNeg);
        const count = Math.trunc(r?.count ?? 0);
        if (net === 0 && grossVolume === 0 && count === 0) continue;
        ordered.push({
          category: key,
          net,
          grossVolume,
          count,
        });
      }
      breakdown = ordered;
    }

    return { kpis, series, breakdown };
  }
}
