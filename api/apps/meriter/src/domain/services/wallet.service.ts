import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { Wallet } from '../aggregates/wallet/wallet.entity';
import { UserId, CommunityId } from '../value-objects';
import { WalletBalanceChangedEvent } from '../events';
import { EventBus } from '../events/event-bus';
import { uid } from 'uid';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';
import {
  type MeritHistoryDashboardPeriodDays,
  type MeritHistoryFilterKey,
} from '../common/helpers/wallet-transaction-history';
import {
  WALLET_PERSISTENCE_PORT,
  type WalletPersistencePort,
  type WalletPersistenceSession,
  type WalletTransactionRecord,
} from '../ports/wallet.persistence.port';

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

export type Transaction = WalletTransactionRecord;

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
    @Inject(WALLET_PERSISTENCE_PORT)
    private readonly walletPersistence: WalletPersistencePort,
    private eventBus: EventBus,
  ) {}

  async startSession(): Promise<WalletPersistenceSession> {
    return this.walletPersistence.startSession();
  }

  async getWallet(userId: string, communityId: string): Promise<Wallet | null> {
    const snapshot = await this.walletPersistence.findWalletByUserAndCommunity(
      userId,
      communityId,
    );
    return snapshot ? Wallet.fromSnapshot(snapshot) : null;
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

      await this.walletPersistence.insertWallet(wallet.toSnapshot());
    }

    const start =
      wasNew &&
      communityId !== GLOBAL_COMMUNITY_ID &&
      typeof options?.startingMeritsIfNewWallet === 'number'
        ? options.startingMeritsIfNewWallet
        : 0;

    if (start > 0) {
      const walletId = wallet.getId.getValue();
      const already = await this.walletPersistence.findTransactionByWalletAndReferenceType(
        walletId,
        'community_starting_merits',
      );
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
    session?: WalletPersistenceSession,
  ): Promise<Wallet> {
    let wallet = await this.getWallet(userId, communityId);
    const isNewWallet = !wallet;

    if (!wallet) {
      wallet = Wallet.create(
        UserId.fromString(userId),
        CommunityId.fromString(communityId),
        currency,
      );
    }

    if (type === 'credit') {
      wallet.add(amount);
    } else {
      wallet.deduct(amount);
    }

    const walletSnapshot = wallet.toSnapshot();
    if (isNewWallet) {
      await this.walletPersistence.insertWallet(walletSnapshot, session);
    } else {
      await this.walletPersistence.updateWallet(walletSnapshot, session);
    }

    let transactionType: WalletTransactionRecord['type'];
    if (referenceType === 'publication_withdrawal' || referenceType === 'comment_withdrawal') {
      transactionType = 'withdrawal';
    } else if (
      referenceType === 'vote' ||
      referenceType === 'publication_vote' ||
      referenceType === 'comment_vote' ||
      referenceType === 'document_variant_vote'
    ) {
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

    const now = new Date();
    await this.walletPersistence.insertTransaction(
      {
        id: uid(),
        walletId: wallet.getId.getValue(),
        type: transactionType,
        amount: Math.abs(amount),
        description:
          description || `${transactionType} ${referenceType ? `(${referenceType})` : ''}`,
        referenceType,
        referenceId,
        createdAt: now,
        updatedAt: now,
      },
      session,
    );

    await this.eventBus.publish(
      new WalletBalanceChangedEvent(
        wallet.getId.getValue(),
        userId,
        communityId,
        amount,
        type,
      ),
    );

    return wallet;
  }

  /**
   * Atomic balance-checked debit (single findOneAndUpdate): safe under concurrent
   * spends, unlike addTransaction's read-modify-write. Returns false when the
   * wallet is missing or balance is insufficient (nothing is written).
   */
  async debitIfSufficient(
    userId: string,
    communityId: string,
    amount: number,
    referenceType: string,
    referenceId: string,
    description?: string,
  ): Promise<boolean> {
    if (amount <= 0) {
      return true;
    }
    const updated = await this.walletPersistence.debitWalletIfSufficient(
      userId,
      communityId,
      amount,
    );
    if (!updated) {
      return false;
    }

    const now = new Date();
    await this.walletPersistence.insertTransaction({
      id: uid(),
      walletId: updated.id,
      type: 'withdrawal',
      amount: Math.abs(amount),
      description: description || `withdrawal (${referenceType})`,
      referenceType,
      referenceId,
      createdAt: now,
      updatedAt: now,
    });

    await this.eventBus.publish(
      new WalletBalanceChangedEvent(updated.id, userId, communityId, amount, 'debit'),
    );

    return true;
  }

  async getTransactions(
    walletId: string,
    limit: number = 50,
    skip: number = 0,
  ): Promise<Transaction[]> {
    return this.walletPersistence.findTransactionsByWalletId(walletId, limit, skip);
  }

  async getUserWallet(userId: string, communityId: string): Promise<Wallet | null> {
    return this.getWallet(userId, communityId);
  }

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
    await this.walletPersistence.deleteTransactionsByWalletId(walletId);
    await this.walletPersistence.deleteWalletById(walletId);
  }

  async getUserWallets(userId: string): Promise<Wallet[]> {
    const snapshots = await this.walletPersistence.findWalletsByUserId(userId);
    return snapshots.map((snapshot) => Wallet.fromSnapshot(snapshot));
  }

  async createTransaction(
    walletId: string,
    type: string,
    amount: number,
    description: string,
    referenceType?: string,
    referenceId?: string,
  ): Promise<any> {
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
    return null;
  }

  async getTransactionByReference(
    _type: string,
    _referenceId: string,
    _userId: string,
  ): Promise<any> {
    return null;
  }

  async getTransactionsByReference(
    _type: string,
    _referenceId: string,
    _limit: number,
    _skip: number,
  ): Promise<any[]> {
    return [];
  }

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
    const [total, data] = await Promise.all([
      this.walletPersistence.countMeritHistoryTransactions(walletId, category),
      this.walletPersistence.findMeritHistoryTransactions(walletId, category, limit, skip),
    ]);

    return { data, total };
  }

  async deleteTransaction(_id: string): Promise<void> {}

  async creditWelcomeMeritsIfNeeded(userId: string, amount: number): Promise<boolean> {
    if (amount <= 0) return false;
    const wallet = await this.createOrGetWallet(userId, GLOBAL_COMMUNITY_ID, DEFAULT_CURRENCY);
    const walletId = wallet.getId.getValue();
    const existing = await this.walletPersistence.findTransactionByWalletAndReferenceType(
      walletId,
      'welcome_merits',
    );
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

  async getTotalWithdrawnByReference(referenceType: string, referenceId: string): Promise<number> {
    return this.walletPersistence.sumWithdrawnByReference(referenceType, referenceId);
  }

  async sumProjectInvestorPayoutCreditsByProjects(
    userId: string,
    projectIds: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (projectIds.length === 0) return result;
    const walletId = await this.walletPersistence.findGlobalWalletIdByUserId(userId);
    if (!walletId) return result;
    return this.walletPersistence.sumProjectInvestorPayoutCredits(walletId, projectIds);
  }

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
    return this.walletPersistence.aggregateMeritHistoryDashboard(walletId, category, periodDays);
  }

  async getCommunityMeritHistoryTransactions(
    contextCommunityId: string,
    category: MeritHistoryFilterKey,
    limit: number,
    skip: number,
  ): Promise<{
    data: Transaction[];
    total: number;
    walletOwnerByTxId: Map<string, string>;
  }> {
    return this.walletPersistence.findCommunityMeritHistoryTransactions(
      contextCommunityId,
      category,
      limit,
      skip,
    );
  }
}
