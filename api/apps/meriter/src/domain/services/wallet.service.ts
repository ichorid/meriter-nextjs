import { Injectable, Logger } from '@nestjs/common';
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

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

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
    currency: { singular: string; plural: string; genitive: string }
  ): Promise<Wallet> {
    let wallet = await this.getWallet(userId, communityId);
    
    if (!wallet) {
      wallet = Wallet.create(
        UserId.fromString(userId),
        CommunityId.fromString(communityId),
        currency
      );
      
      await this.walletModel.create(wallet.toSnapshot());
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

  async getUserTransactions(
    _userId: string,
    _type: string,
    _limit: number,
    _skip: number,
  ): Promise<any[]> {
    // This is a simplified implementation
    return [];
  }

  async deleteTransaction(_id: string): Promise<void> {
    // This is a simplified implementation
  }

  /**
   * Credit 100 welcome merits to global wallet on first registration.
   * Idempotent: does nothing if user already received welcome merits.
   */
  async creditWelcomeMeritsIfNeeded(userId: string): Promise<boolean> {
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
      100,
      'personal',
      'welcome_merits',
      userId,
      DEFAULT_CURRENCY,
      'Welcome merits at registration',
    );
    this.logger.log(`Credited 100 welcome merits to user ${userId}`);
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
}
