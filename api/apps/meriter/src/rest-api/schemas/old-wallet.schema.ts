import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Wallet } from '../../wallets/model/wallet.model';
import { OldUser } from './old-user.schema';
import { Document } from 'mongoose';
export type OldWalletDocument = OldWallet & Document;
@Schema({ collection: 'wallets' })
export class OldWallet {
  @Prop({ type: Number, default: 0 })
  amount: number;
  @Prop()
  tgUserId: string;

  @Prop()
  currencyOfCommunityTgChatId: string;
  @Prop({
    type: {
      1: String,
      2: String,
      5: String,
      many: String,
    },
  })
  currencyNames: {
    1: string;
    2: string;
    5: string;
    many: string;
  };
}

export const OldWalletSchema = SchemaFactory.createForClass(OldWallet);

export const mapOldWalletToWallet = (oldWallet: OldWallet): Partial<Wallet> => {
  return {
    meta: {
      currencyOfCommunityTgChatId: oldWallet.currencyOfCommunityTgChatId,
      telegramUserId: oldWallet.tgUserId,
      currencyNames: {
        1: oldWallet.currencyNames?.['1'],
        2: oldWallet.currencyNames?.['2'],
        5: oldWallet.currencyNames?.['5'],
        many: oldWallet.currencyNames?.many,
      },
    },
    updatedAt: undefined,
    value: oldWallet.amount,
  };
};

export const mapWalletToOldWallet = (wallet: Wallet): OldWallet => {
  return {
    amount: wallet.value,
    currencyNames: {
      1: wallet.meta?.currencyNames?.['1'],
      2: wallet.meta?.currencyNames?.['2'],
      5: wallet.meta?.currencyNames?.['5'],
      many: wallet.meta?.currencyNames?.many,
    },
    currencyOfCommunityTgChatId: wallet.meta.currencyOfCommunityTgChatId,
    tgUserId: wallet.meta.telegramUserId,
  };
};
