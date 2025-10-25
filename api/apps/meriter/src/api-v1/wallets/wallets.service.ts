import { Injectable, Logger } from '@nestjs/common';
import { WalletsService as LegacyWalletsService } from '../../wallets/wallets.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { PaginationHelper, PaginationResult } from '../../common/helpers/pagination.helper';
import { Wallet, Transaction } from '../types/domain.types';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    private readonly legacyWalletsService: LegacyWalletsService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async getUserWallets(userId: string): Promise<Wallet[]> {
    const wallets = await this.legacyWalletsService.model.find({
      'meta.telegramUserId': userId,
    });

    return wallets.map(wallet => this.mapToWallet(wallet));
  }

  async getUserWallet(userId: string, communityId: string): Promise<Wallet> {
    const walletQuery = {
      currencyOfCommunityTgChatId: communityId,
      telegramUserId: userId,
      domainName: 'wallet',
    };
    
    const balance = await this.legacyWalletsService.getValue(walletQuery);
    
    // Get community info for currency names
    const communityWallet = await this.legacyWalletsService.model.findOne({
      'meta.telegramUserId': userId,
      'meta.currencyOfCommunityTgChatId': communityId,
    });

    return {
      id: `${userId}-${communityId}`,
      userId,
      communityId,
      balance: balance || 0,
      currency: {
        singular: communityWallet?.meta?.currencyNames?.[1] || 'merit',
        plural: communityWallet?.meta?.currencyNames?.[5] || 'merits',
        genitive: communityWallet?.meta?.currencyNames?.[5] || 'merits',
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  async getUserTransactions(
    userId: string,
    pagination: any,
    filters: any,
  ): Promise<PaginationResult<Transaction>> {
    const skip = PaginationHelper.getSkip(pagination);

    const query: any = {
      'meta.from.telegramUserId': userId,
    };

    if (filters.communityId) {
      query['meta.amounts.currencyOfCommunityTgChatId'] = filters.communityId;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    const transactions = await this.transactionsService.model
      .find(query)
      .skip(skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 })
      .lean();

    const total = await this.transactionsService.model.countDocuments(query);

    const mappedTransactions = transactions.map(transaction => this.mapToTransaction(transaction));

    return PaginationHelper.createResult(mappedTransactions, total, pagination);
  }

  async getUserQuota(userId: string, communityId?: string): Promise<number> {
    const free = await this.transactionsService.getFreeLimit(userId, communityId);
    return free;
  }

  async withdrawFromWallet(userId: string, communityId: string, amount: number, memo?: string): Promise<Transaction> {
    // Implementation for withdrawal - this would create a withdrawal transaction
    // For now, return a mock transaction - implement actual withdrawal logic
    const withdrawalTransaction = {
      uid: `withdraw-${Date.now()}`,
      type: 'withdrawal',
      meta: {
        from: { telegramUserId: userId },
        amounts: {
          total: -amount,
          currencyOfCommunityTgChatId: communityId,
        },
        comment: memo,
      },
      createdAt: new Date(),
    };

    return this.mapToTransaction(withdrawalTransaction);
  }

  async transferToUser(fromUserId: string, communityId: string, toUserId: string, amount: number, description?: string): Promise<Transaction> {
    // Implementation for transfer - this would create a transfer transaction
    // For now, return a mock transaction - implement actual transfer logic
    const transferTransaction = {
      uid: `transfer-${Date.now()}`,
      type: 'transfer',
      meta: {
        from: { telegramUserId: fromUserId },
        to: { telegramUserId: toUserId },
        amounts: {
          total: -amount,
          currencyOfCommunityTgChatId: communityId,
        },
        comment: description,
      },
      createdAt: new Date(),
    };

    return this.mapToTransaction(transferTransaction);
  }

  async getCommunityLeaderboard(
    communityId: string,
    pagination: any,
  ): Promise<PaginationResult<any>> {
    const skip = PaginationHelper.getSkip(pagination);

    // Get leaderboard data from transactions
    const leaderboard = await this.transactionsService.model.aggregate([
      {
        $match: {
          'meta.amounts.currencyOfCommunityTgChatId': communityId,
          'meta.from.telegramUserId': { $exists: true },
        },
      },
      {
        $group: {
          _id: '$meta.from.telegramUserId',
          totalReceived: {
            $sum: {
              $cond: [
                { $gt: ['$meta.amounts.total', 0] },
                '$meta.amounts.total',
                0,
              ],
            },
          },
          totalGiven: {
            $sum: {
              $cond: [
                { $lt: ['$meta.amounts.total', 0] },
                { $abs: '$meta.amounts.total' },
                0,
              ],
            },
          },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $addFields: {
          netScore: { $subtract: ['$totalReceived', '$totalGiven'] },
        },
      },
      {
        $sort: { netScore: -1 },
      },
      {
        $skip: skip,
      },
      {
        $limit: pagination.limit,
      },
    ]);

    const total = await this.transactionsService.model.aggregate([
      {
        $match: {
          'meta.amounts.currencyOfCommunityTgChatId': communityId,
          'meta.from.telegramUserId': { $exists: true },
        },
      },
      {
        $group: {
          _id: '$meta.from.telegramUserId',
        },
      },
      {
        $count: 'total',
      },
    ]);

    const mappedLeaderboard = leaderboard.map((item, index) => ({
      rank: skip + index + 1,
      userId: item._id,
      totalReceived: item.totalReceived,
      totalGiven: item.totalGiven,
      netScore: item.netScore,
      transactionCount: item.transactionCount,
    }));

    return PaginationHelper.createResult(
      mappedLeaderboard,
      total[0]?.total || 0,
      pagination,
    );
  }

  private mapToWallet(wallet: any): Wallet {
    return {
      id: wallet.uid,
      userId: wallet.meta?.telegramUserId || '',
      communityId: wallet.meta?.currencyOfCommunityTgChatId || '',
      balance: wallet.value || 0,
      currency: {
        singular: wallet.meta?.currencyNames?.[1] || 'merit',
        plural: wallet.meta?.currencyNames?.[5] || 'merits',
        genitive: wallet.meta?.currencyNames?.[5] || 'merits',
      },
      lastUpdated: wallet.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  private mapToTransaction(transaction: any): Transaction {
    return {
      id: transaction.uid,
      userId: transaction.meta?.from?.telegramUserId || '',
      communityId: transaction.meta?.amounts?.currencyOfCommunityTgChatId || '',
      type: transaction.type,
      amount: transaction.meta?.amounts?.total || 0,
      description: transaction.meta?.comment,
      metadata: {
        targetType: transaction.meta?.parentPublicationUri ? 'publication' : 'comment',
        targetId: transaction.meta?.parentPublicationUri || transaction.meta?.parentTransactionUri,
        sourceType: transaction.meta?.amounts?.free ? 'daily_quota' : 'personal',
      },
      createdAt: transaction.createdAt?.toISOString() || new Date().toISOString(),
    };
  }
}
