import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../repositories/base.repository';
import { Wallet, WalletDocument } from './wallet.schema';

@Injectable()
export class WalletRepository extends BaseRepository<Wallet> {
  constructor(@InjectModel(Wallet.name) model: Model<WalletDocument>) {
    super(model);
  }

  async findByUser(userId: string): Promise<Wallet[]> {
    return this.find({ userId }, { sort: { lastUpdated: -1 } });
  }

  async findByUserAndCommunity(userId: string, communityId: string): Promise<Wallet | null> {
    return this.findOne({ userId, communityId });
  }

  async updateBalance(id: string, delta: number): Promise<Wallet | null> {
    return this.model.findByIdAndUpdate(
      id,
      { 
        $inc: { balance: delta },
        $set: { lastUpdated: new Date() }
      },
      { new: true }
    ).lean().exec();
  }

  async createOrUpdate(userId: string, communityId: string, currency: any, initialBalance: number = 0): Promise<Wallet> {
    const existing = await this.findByUserAndCommunity(userId, communityId);
    
    if (existing) {
      return existing;
    }

    return this.create({
      id: this.generateId(),
      userId,
      communityId,
      balance: initialBalance,
      currency,
      lastUpdated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  private generateId(): string {
    return `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
