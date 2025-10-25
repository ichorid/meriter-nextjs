import { Injectable, Logger } from '@nestjs/common';
import { WalletServiceV2 } from '../../domain/services/wallet.service-v2';
import { PaginationHelper, PaginationResult } from '../../common/helpers/pagination.helper';
import { Wallet, Transaction } from '../types/domain.types';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    private readonly walletServiceV2: WalletServiceV2,
  ) {}

  async getUserWallets(userId: string): Promise<Wallet[]> {
    // Get all wallets for user
    const wallets = await this.walletServiceV2.getUserWallets(userId);
    return wallets.map(wallet => this.mapToWallet(wallet));
  }

  async getUserWallet(userId: string, communityId: string): Promise<Wallet> {
    const wallet = await this.walletServiceV2.getUserWallet(userId, communityId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    return this.mapToWallet(wallet);
  }

  async getWalletBalance(userId: string, communityId: string): Promise<number> {
    const wallet = await this.walletServiceV2.getUserWallet(userId, communityId);
    return wallet ? wallet.getBalance() : 0;
  }

  async getWalletTransactions(
    userId: string,
    communityId: string,
    pagination: any,
  ): Promise<PaginationResult<Transaction>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    const wallet = await this.walletServiceV2.getUserWallet(userId, communityId);
    if (!wallet) {
      return PaginationHelper.createResult([], 0, pagination);
    }

    const transactions = await this.walletServiceV2.getTransactions(
      wallet.getId.getValue(),
      pagination.limit,
      skip
    );

    const mappedTransactions = transactions.map(transaction => this.mapToTransaction(transaction));

    return PaginationHelper.createResult(mappedTransactions, mappedTransactions.length, pagination);
  }

  async createTransaction(
    userId: string,
    communityId: string,
    type: string,
    amount: number,
    description: string,
    referenceType?: string,
    referenceId?: string,
  ): Promise<Transaction> {
    const wallet = await this.walletServiceV2.getUserWallet(userId, communityId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const transaction = await this.walletServiceV2.createTransaction(
      wallet.getId.getValue(),
      type,
      amount,
      description,
      referenceType,
      referenceId
    );

    return this.mapToTransaction(transaction);
  }

  async delta(amount: number, walletQuery: any): Promise<void> {
    // This is a simplified implementation
    // In reality, you'd need to find the wallet and update its balance
    this.logger.log(`Delta operation: ${amount} for wallet query: ${JSON.stringify(walletQuery)}`);
  }

  private mapToWallet(wallet: any): Wallet {
    return {
      id: wallet.getId?.getValue() || wallet.id,
      userId: wallet.getUserId?.getValue() || wallet.userId,
      communityId: wallet.getCommunityId?.getValue() || wallet.communityId,
      balance: wallet.getBalance?.() || wallet.balance || 0,
      currency: {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      },
      lastUpdated: wallet.getUpdatedAt?.()?.toISOString() || wallet.updatedAt?.toISOString() || new Date().toISOString(),
      createdAt: wallet.getCreatedAt?.()?.toISOString() || wallet.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: wallet.getUpdatedAt?.()?.toISOString() || wallet.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  async getUserTransactions(userId: string, pagination: any, query: any): Promise<PaginationResult<Transaction>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    // This is a simplified implementation
    const transactions: Transaction[] = [];
    
    return PaginationHelper.createResult(transactions, 0, pagination);
  }

  async getUserQuota(userId: string, communityId: string): Promise<any> {
    // This is a simplified implementation
    return {
      dailyQuota: 100,
      usedQuota: 0,
      remainingQuota: 100,
    };
  }

  async withdrawFromWallet(userId: string, communityId: string, amount: number, memo?: string): Promise<Transaction> {
    // This is a simplified implementation
    return this.createTransaction(
      userId,
      communityId,
      'withdrawal',
      -amount,
      memo || 'Withdrawal',
      'withdrawal',
      'manual'
    );
  }

  async transferToUser(
    userId: string,
    communityId: string,
    toUserId: string,
    amount: number,
    description: string,
  ): Promise<Transaction> {
    // This is a simplified implementation
    return this.createTransaction(
      userId,
      communityId,
      'transfer',
      -amount,
      `Transfer to ${toUserId}: ${description}`,
      'transfer',
      toUserId
    );
  }

  private mapToTransaction(transaction: any): Transaction {
    return {
      id: transaction.getId?.getValue() || transaction.id,
      walletId: transaction.getWalletId?.getValue() || transaction.walletId,
      type: transaction.getType?.() || transaction.type,
      amount: transaction.getAmount?.() || transaction.amount,
      description: transaction.getDescription?.() || transaction.description,
      referenceType: transaction.getReferenceType?.() || transaction.referenceType,
      referenceId: transaction.getReferenceId?.() || transaction.referenceId,
      createdAt: transaction.getCreatedAt?.()?.toISOString() || transaction.createdAt?.toISOString() || new Date().toISOString(),
    };
  }
}