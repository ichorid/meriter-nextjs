import mongoose from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { TgChat } from '../tg-chats/model/tg-chat.model';
import { Actor } from '@common/abstracts/actors/schema/actor.schema';
import { Hashtag } from '../hashtags/model/hashtag.model';
import { IActor } from '@common/abstracts/actors/model/actor.interface';
import { Asset } from '@common/abstracts/assets/schema/asset.schema';
import { Publication } from '../publications/model/publication.model';
import { Agreement } from '@common/abstracts/agreements/schema/agreement.schema';
import { Transaction } from '../transactions/model/transaction.model';
import { Wallet } from '../wallets/model/wallet.model';

export { Types } from 'mongoose';
const ObjectId = mongoose.Schema.Types.ObjectId;

// These URLs are for migration purposes only and are no longer used
// Use environment variables instead: MONGO_URL_MERITERRA, MONGO_URL_MERITERCORP, MONGO_URL_TEST
let MONGO_URL = process.env.MONGO_URL_MERITERRA || '';
if (!MONGO_URL) {
  MONGO_URL = process.env.MONGO_URL_MERITERCORP || '';
}
if (!MONGO_URL) {
  MONGO_URL = process.env.MONGO_URL_TEST || '';
}

/*
 tgChannelId,
    tgMessageId,
    tgAuthorId,
    keyword,
    */

@Schema()
export class OldCapitalization {
  @Prop()
  ofUserTgId: string;
  @Prop()
  currencyOfCommutityTgChatId: string;
  @Prop()
  currencyOfCommunityTgChatId: string;
  @Prop({ type: Number, default: 0 })
  amount: number;
  @Prop()
  type: string;
}

export const OldCapitalizationSchema = SchemaFactory.createForClass(
  OldCapitalization,
);

@Schema()
export class OldSentTGMessageLog {
  @Prop()
  toUserTgId: string;
  @Prop()
  fromBot: boolean;
  @Prop()
  tgChatId: string;
  @Prop()
  text: string;
  @Prop(Object)
  query: Record<string, unknown>;
  @Prop()
  comment: string;
  @Prop({
    type: Date,
    default: () => new Date(),
  })
  ts: string;
}

export const OldSentTGMessageLogSchema = SchemaFactory.createForClass(
  OldSentTGMessageLog,
);

@Schema()
export class OldEntity {
  @Prop([String])
  tgChatIds: string[];

  @Prop()
  icon: string;

  @Prop(Object)
  currencyNames: Record<string, unknown>;

  @Prop(Number)
  dailyEmission: number;
}
export const OldEntitySchema = SchemaFactory.createForClass(OldEntity);
