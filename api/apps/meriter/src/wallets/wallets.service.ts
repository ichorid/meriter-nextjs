import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Wallet, WalletDocument } from '../domain/models/wallet/wallet.schema';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(@InjectModel(Wallet.name) public readonly model: Model<WalletDocument>) {}

  async getWallet(userId: string, communityId: string): Promise<any> {
    // Stub implementation
    return { id: `${userId}-${communityId}`, balance: 0 };
  }

  async getValue(query: any): Promise<number> {
    // Stub implementation
    return 0;
  }

  async delta(amount: number, query: any): Promise<void> {
    // Stub implementation
    return;
  }

  async initWallet(amount: number, query: any): Promise<any> {
    // Stub implementation
    return { id: 'stub', balance: amount };
  }
}
