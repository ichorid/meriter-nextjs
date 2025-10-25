import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Wallet, WalletDocument } from './wallet.schema';

@Injectable()
export class WalletRepository {
  constructor(@InjectModel(Wallet.name) private readonly model: Model<WalletDocument>) {}

  async findByUser(userId: string): Promise<Wallet[]> {
    return this.model
      .find({ userId })
      .sort({ lastUpdated: -1 })
      .lean()
      .exec();
  }

  async findByUserAndCommunity(userId: string, communityId: string): Promise<Wallet | null> {
    return this.model.findOne({ userId, communityId }).lean().exec();
  }

  async findById(id: string): Promise<Wallet | null> {
    return this.model.findById(id).lean().exec();
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

    return this.model.create({
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
