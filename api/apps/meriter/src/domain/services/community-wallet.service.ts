import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CommunityWalletSchemaClass,
  CommunityWalletDocument,
} from '../models/community-wallet/community-wallet.schema';
import type { CommunityWallet } from '../models/community-wallet/community-wallet.schema';
import { uid } from 'uid';

@Injectable()
export class CommunityWalletService {
  constructor(
    @InjectModel(CommunityWalletSchemaClass.name)
    private readonly communityWalletModel: Model<CommunityWalletDocument>,
  ) {}

  /**
   * Create a wallet for a community (e.g. project). Idempotent: if wallet exists, return it.
   */
  async createWallet(communityId: string): Promise<CommunityWallet> {
    const existing = await this.communityWalletModel
      .findOne({ communityId })
      .lean();
    if (existing) {
      return existing as unknown as CommunityWallet;
    }
    const doc = await this.communityWalletModel.create({
      id: uid(),
      communityId,
      balance: 0,
      totalReceived: 0,
      totalDistributed: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return doc.toObject() as unknown as CommunityWallet;
  }

  /**
   * Get wallet by community ID.
   */
  async getWallet(communityId: string): Promise<CommunityWallet | null> {
    const doc = await this.communityWalletModel
      .findOne({ communityId })
      .lean();
    return doc ? (doc as unknown as CommunityWallet) : null;
  }

  /**
   * Get balance for a community wallet. Returns 0 if no wallet.
   */
  async getBalance(communityId: string): Promise<number> {
    const wallet = await this.getWallet(communityId);
    return wallet?.balance ?? 0;
  }

  /**
   * Atomic deposit: increment balance and totalReceived.
   */
  async deposit(
    communityId: string,
    amount: number,
    _reason?: string,
  ): Promise<CommunityWallet> {
    if (amount <= 0) {
      throw new BadRequestException('Deposit amount must be positive');
    }
    const doc = await this.communityWalletModel.findOneAndUpdate(
      { communityId },
      {
        $inc: { balance: amount, totalReceived: amount },
        $set: { updatedAt: new Date() },
      },
      { new: true },
    );
    if (!doc) {
      throw new NotFoundException(
        `CommunityWallet not found for community ${communityId}`,
      );
    }
    return doc.toObject() as unknown as CommunityWallet;
  }

  /**
   * Atomic debit: decrement balance and increment totalDistributed only if balance >= amount.
   */
  async debit(
    communityId: string,
    amount: number,
    _reason?: string,
  ): Promise<CommunityWallet> {
    if (amount <= 0) {
      throw new BadRequestException('Debit amount must be positive');
    }
    const doc = await this.communityWalletModel.findOneAndUpdate(
      { communityId, balance: { $gte: amount } },
      {
        $inc: { balance: -amount, totalDistributed: amount },
        $set: { updatedAt: new Date() },
      },
      { new: true },
    );
    if (!doc) {
      const wallet = await this.getWallet(communityId);
      const balance = wallet?.balance ?? 0;
      throw new BadRequestException(
        `Insufficient balance: have ${balance}, need ${amount}`,
      );
    }
    return doc.toObject() as unknown as CommunityWallet;
  }
}
