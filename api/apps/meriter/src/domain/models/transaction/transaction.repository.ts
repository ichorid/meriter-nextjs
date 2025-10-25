import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../repositories/base.repository';
import { Transaction, TransactionDocument } from './transaction.schema';

@Injectable()
export class TransactionRepository extends BaseRepository<Transaction> {
  constructor(@InjectModel(Transaction.name) model: Model<TransactionDocument>) {
    super(model);
  }

  async findByWallet(walletId: string, limit: number = 50, skip: number = 0): Promise<Transaction[]> {
    return this.find(
      { walletId },
      { limit, skip, sort: { createdAt: -1 } }
    );
  }

  async findByReference(referenceType: string, referenceId: string): Promise<Transaction[]> {
    return this.find({ referenceType, referenceId });
  }
}
