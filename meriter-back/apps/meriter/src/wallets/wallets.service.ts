import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CountersService } from '@common/abstracts/counters/counters.service';

import { HashtagsService } from '../hashtags/hashtags.service';

import { Document, FilterQuery, Model, Query } from 'mongoose';
import { Wallet, WalletMeta } from './model/wallet.model';

@Injectable()
export class WalletsService {
  constructor(
    private countersService: CountersService, // @Inject(forwardRef(() => TransactionsService)) //private transactionsService: TransactionsService,
  ) {
    this.model = (this.countersService.model as unknown) as Model<
      Wallet & Document
    >;
  }
  model: Model<Wallet & Document>;

  delta(value: number, walletQuery: Record<string, unknown>) {
    return this.countersService.pushToCounter('wallet', value, walletQuery);
  }
  async initWallet(value: number, walletQuery: Record<string, unknown>) {
    return this.countersService.initCounter('wallet', value, walletQuery);
  }

  getValue(walletQuery: Record<string, unknown>) {
    return this.countersService.getCounter(walletQuery);
  }

  rank() {}
}
