import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CommunityWalletSchemaClass,
  CommunityWalletDocument,
} from '../../domain/models/community-wallet/community-wallet.schema';
import {
  COMMUNITY_WALLET_PERSISTENCE_PORT,
  type CommunityWalletPersistencePort,
  type CommunityWalletRecord,
  type CreateCommunityWalletInput,
} from '../../domain/ports/community-wallet.persistence.port';

function toRecord(doc: CommunityWalletDocument | Record<string, unknown>): CommunityWalletRecord {
  const row = 'toObject' in doc && typeof doc.toObject === 'function'
    ? doc.toObject()
    : doc;
  return row as CommunityWalletRecord;
}

@Injectable()
export class CommunityWalletPersistenceAdapter implements CommunityWalletPersistencePort {
  constructor(
    @InjectModel(CommunityWalletSchemaClass.name)
    private readonly communityWalletModel: Model<CommunityWalletDocument>,
  ) {}

  async findByCommunityId(communityId: string): Promise<CommunityWalletRecord | null> {
    const doc = await this.communityWalletModel.findOne({ communityId }).lean().exec();
    return doc ? (doc as CommunityWalletRecord) : null;
  }

  async createWallet(input: CreateCommunityWalletInput): Promise<CommunityWalletRecord> {
    const doc = await this.communityWalletModel.create(input);
    return toRecord(doc);
  }

  async deposit(
    communityId: string,
    amount: number,
    updatedAt: Date,
  ): Promise<CommunityWalletRecord | null> {
    const doc = await this.communityWalletModel.findOneAndUpdate(
      { communityId },
      {
        $inc: { balance: amount, totalReceived: amount },
        $set: { updatedAt },
      },
      { new: true },
    );
    return doc ? toRecord(doc) : null;
  }

  async deductBalance(
    communityId: string,
    amount: number,
    updatedAt: Date,
  ): Promise<CommunityWalletRecord | null> {
    const doc = await this.communityWalletModel.findOneAndUpdate(
      { communityId, balance: { $gte: amount } },
      {
        $inc: { balance: -amount },
        $set: { updatedAt },
      },
      { new: true },
    );
    return doc ? toRecord(doc) : null;
  }

  async debit(
    communityId: string,
    amount: number,
    updatedAt: Date,
  ): Promise<CommunityWalletRecord | null> {
    const doc = await this.communityWalletModel.findOneAndUpdate(
      { communityId, balance: { $gte: amount } },
      {
        $inc: { balance: -amount, totalDistributed: amount },
        $set: { updatedAt },
      },
      { new: true },
    );
    return doc ? toRecord(doc) : null;
  }

  async addTotalDistributed(
    communityId: string,
    amount: number,
    updatedAt: Date,
  ): Promise<CommunityWalletRecord | null> {
    const doc = await this.communityWalletModel.findOneAndUpdate(
      { communityId },
      {
        $inc: { totalDistributed: amount },
        $set: { updatedAt },
      },
      { new: true },
    );
    return doc ? toRecord(doc) : null;
  }
}

export const communityWalletPersistenceProvider = {
  provide: COMMUNITY_WALLET_PERSISTENCE_PORT,
  useClass: CommunityWalletPersistenceAdapter,
};
