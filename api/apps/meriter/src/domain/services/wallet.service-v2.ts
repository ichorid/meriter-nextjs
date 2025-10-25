import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, ClientSession } from 'mongoose';
import { Wallet } from '../aggregates/wallet/wallet.entity';
import { Wallet as WalletSchema, WalletDocument } from '../models/wallet/wallet.schema';
import { Transaction } from '../models/transaction/transaction.schema';
import { UserId, CommunityId, WalletId } from '../value-objects';
import { WalletBalanceChangedEvent } from '../events';
import { EventBus } from '../events/event-bus';
import { v4 as uuidv4 } from 'uuid';

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
    
    return doc ? Wallet.fromSnapshot(doc as any) : null;
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
        id: uuidv4(),
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
    return this.mongoose.models.Transaction
      .find({ walletId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean();
  }
}
