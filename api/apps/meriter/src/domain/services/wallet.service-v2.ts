import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, ClientSession } from 'mongoose';
import { Wallet } from '../aggregates/wallet/wallet.entity';
import { Wallet as WalletSchema, WalletDocument } from '../models/wallet/wallet.schema';
import { Transaction } from '../models/transaction/transaction.schema';
import { UserId, CommunityId, WalletId } from '../value-objects';
import { WalletBalanceChangedEvent } from '../events';
import { EventBus } from '../events/event-bus';
import { uid } from 'uid';
import { WalletDocument as IWalletDocument } from '../../common/interfaces/wallet-document.interface';

@Injectable()
export class WalletServiceV2 {
  private readonly logger = new Logger(WalletServiceV2.name);

  constructor(
    @InjectModel(WalletSchema.name) private walletModel: Model<WalletDocument>,
    @InjectConnection() private mongoose: Connection,
    private eventBus: EventBus,
  ) {}

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
    description?: string
  ): Promise<Wallet> {
    const session = await this.mongoose.startSession();
    session.startTransaction();

    try {
      // Get or create wallet
      let wallet = await this.getWallet(userId, communityId);
      
      if (!wallet) {
        wallet = Wallet.create(
          UserId.fromString(userId),
          CommunityId.fromString(communityId),
          currency
        );
      }

      // Domain logic
      if (type === 'credit') {
        wallet.add(amount);
      } else {
        wallet.deduct(amount);
      }

      // Save wallet
      await this.walletModel.updateOne(
        { id: wallet.getId.getValue() },
        { $set: wallet.toSnapshot() },
        { upsert: true, session }
      );

      // Create transaction record
      await this.mongoose.models.Transaction.create([{
        id: uid(),
        walletId: wallet.getId.getValue(),
        type,
        amount,
        sourceType,
        referenceType,
        referenceId,
        description,
        createdAt: new Date(),
      }], { session });

      await session.commitTransaction();

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
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getTransactions(walletId: string, limit: number = 50, skip: number = 0): Promise<Transaction[]> {
    // Direct Mongoose query
    const transactions = await this.mongoose.models.Transaction
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

  async getTransaction(id: string): Promise<any> {
    // This is a simplified implementation
    return null;
  }

  async getTransactionByReference(
    type: string,
    referenceId: string,
    userId: string,
  ): Promise<any> {
    // This is a simplified implementation
    return null;
  }

  async getTransactionsByReference(
    type: string,
    referenceId: string,
    limit: number,
    skip: number,
  ): Promise<any[]> {
    // This is a simplified implementation
    return [];
  }

  async getUserTransactions(
    userId: string,
    type: string,
    limit: number,
    skip: number,
  ): Promise<any[]> {
    // This is a simplified implementation
    return [];
  }

  async deleteTransaction(id: string): Promise<void> {
    // This is a simplified implementation
  }
}
