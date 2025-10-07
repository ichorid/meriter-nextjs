import { Actor } from '@common/abstracts/actors/schema/actor.schema';
import { Typify } from '@common/abstracts/helpers/typescript/typescript-helpers';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export abstract class TgChatMeta {
  tgUsername: string;
  tgBotUsername: string;
  iconUrl: string;
  hashtagLabels: string[];
  dailyEmission: number;
  chatAccessLink: string;
  currencyNames: string[];
  url?: string;
  helpUrl?: string;
}

@Schema()
export class TgChat extends Actor {
  @Prop({ type: TgChatMeta })
  declare meta: Typify<TgChatMeta>;
}

export const TgChatSchema = SchemaFactory.createForClass(TgChat);
export type TgChatDocument = Document & TgChat;
