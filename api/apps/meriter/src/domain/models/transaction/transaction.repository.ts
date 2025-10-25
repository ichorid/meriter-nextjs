import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction, TransactionDocument } from './transaction.schema';

@Injectable()
export class TransactionRepository {
  constructor(@InjectModel(Transaction.name) private readonly model: Model<TransactionDocument>) {}

  async findByWallet(walletId: string, limit: number = 50, skip: number = 0): Promise<Transaction[]> {
    return this.model
      .find({ walletId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async findByReference(referenceType: string, referenceId: string): Promise<Transaction[]> {
    return this.model.find({ referenceType, referenceId }).lean().exec();
  }

  async create(transactionData: Partial<Transaction>): Promise<Transaction> {
    const transaction = await this.model.create(transactionData);
    return transaction.toObject();
  }
}
