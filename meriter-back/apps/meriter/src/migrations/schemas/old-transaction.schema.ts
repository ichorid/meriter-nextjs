import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Transaction } from '../../transactions/model/transaction.model';
import { Document } from 'mongoose';

export type OldTransactionDocument = OldTransaction & Document;

@Schema({ collection: 'transactions' })
export class OldTransaction {
  @Prop()
  _id: string;
  @Prop()
  fromUserTgId: string;
  @Prop()
  fromUserTgName: string;
  @Prop()
  toUserTgId: string;
  @Prop()
  currencyOfCommunityTgChatId: string;
  @Prop({
    type: String,
    enum: [
      'forPublication',
      'withdrawalFromPublication',
      'exchange',
      'forTransaction',
      'withdrawalFromTransaction',
      'reward',
    ],
  })
  reason:
    | 'forPublication'
    | 'withdrawalFromPublication'
    | 'exchange'
    | 'forTransaction'
    | 'withdrawalFromTransaction'
    | 'reward';
  @Prop()
  exchangeTransactionId: string;
  @Prop()
  forPublicationSlug: string;
  @Prop([String])
  publicationClassTags: string;
  @Prop()
  inSpaceSlug: string;
  @Prop(Number)
  amountTotal: number;
  @Prop(Number)
  amountFree: number;
  @Prop(Number)
  amount: number;
  @Prop(Boolean)
  directionPlus: boolean;
  @Prop()
  comment: string;
  @Prop({ type: Number, default: 0 })
  plus: number;
  @Prop({ type: Number, default: 0 })
  minus: number;
  @Prop({ type: Number, default: 0 })
  sum: number;
  @Prop()
  inPublicationSlug: string;
  @Prop()
  forTransactionId: string;
  @Prop({
    type: Date,
    // default: Date.now,
  })
  ts: string;
  @Prop({ type: Object })
  dimensions: Record<string, unknown>;

  parentText?: string;
}

export const OldTransactionSchema = SchemaFactory.createForClass(
  OldTransaction,
);

export const mapOldTransactionToTransaction = (
  oldTransaction: OldTransaction,
): Partial<Transaction> => {
  const signum = oldTransaction.directionPlus ? 1 : -1;
  return {
    domainName: 'transaction',
    focusAssetUri: oldTransaction.forPublicationSlug
      ? `asset.publication://${oldTransaction.forPublicationSlug}`
      : `agreement.transaction://${oldTransaction.forTransactionId}`,
    initiatorsActorUris: [
      `actor.user://telegram${oldTransaction.fromUserTgId}`,
    ],
    meta: {
      parentPublicationUri: `agreement.transaction://slug${oldTransaction.inPublicationSlug}`,
      metrics: {
        plus: oldTransaction.plus,
        minus: oldTransaction.minus,
        sum: oldTransaction.sum,
      },
      from: {
        telegramUserId: oldTransaction.fromUserTgId,
        telegramUserName: oldTransaction.fromUserTgName,
      },
      amounts: {
        personal: signum * oldTransaction.amount,
        free: signum * oldTransaction.amountFree,
        total: signum * oldTransaction.amountTotal,
        currencyOfCommunityTgChatId: oldTransaction.currencyOfCommunityTgChatId,
      },
      exchangeTransactionUri: `agreement.transaction://${oldTransaction.exchangeTransactionId}`,
      comment: oldTransaction.comment,
    },
    type: oldTransaction.reason,
    spacesActorUris: [`actor.hashtag://slug${oldTransaction.inSpaceSlug}`],
    subjectsActorUris: [`actor.user://telegram${oldTransaction.toUserTgId}`],
    uid: oldTransaction._id,
    value: oldTransaction.amountTotal,
    createdAt: new Date(
      new Date(
        parseInt(oldTransaction.ts)
          ? parseInt(oldTransaction.ts)
          : oldTransaction.ts,
      ),
    ),
  };
};

const maybeSlug = (uri) => uri?.split('://slug')?.[1] || uri;

export const mapTransactionToOldTransaction = (
  transaction: Transaction,
): Partial<OldTransaction> => {
  return {
    amount: transaction.meta.amounts.personal,
    amountFree: transaction.meta.amounts.free,
    amountTotal: transaction.meta.amounts.total,
    comment: transaction.meta.comment,
    currencyOfCommunityTgChatId:
      transaction.meta.amounts.currencyOfCommunityTgChatId,
    directionPlus: transaction.meta.amounts.total > 0,
    exchangeTransactionId: transaction.meta.exchangeTransactionUri?.split(
      '://',
    )[1],
    forPublicationSlug:
      transaction.type == 'forPublication'
        ? transaction.focusAssetUri.split('://slug')[1]
        : transaction.focusAssetUri.split('://')[1],

    forTransactionId:
      transaction.type == 'forTransaction'
        ? transaction.focusAssetUri.split('://')[1]
        : undefined,
    parentText: transaction.meta?.parentText,
    fromUserTgId: transaction.initiatorsActorUris[0]?.split('://telegram')[1],
    fromUserTgName: transaction.meta.from.telegramUserName,
    inPublicationSlug: maybeSlug(transaction.meta.parentPublicationUri),
    inSpaceSlug: transaction.spacesActorUris[0]?.split('://slug')[1],
    minus: transaction.meta?.metrics?.minus ?? 0,
    plus: transaction.meta?.metrics?.plus ?? 0,
    reason: transaction.type,
    sum: transaction.meta?.metrics?.sum ?? 0,
    toUserTgId: transaction.subjectsActorUris[0]?.split('://telegram')[1],
    ts: transaction?.createdAt?.toString(),
    _id: transaction.uid,
  };
};
