import { Field, ObjectType } from '@nestjs/graphql';
import { Actor } from '@common/abstracts/actors/schema/actor.schema';
import { Typify } from '@common/abstracts/helpers/typescript/typescript-helpers';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
/*
@ObjectType()
export abstract class TgChatMeta {
  @Field()
  tgBotUsername: string;
  @Field({ nullable: true })
  iconUrl: string;
  @Field((type) => [String], { nullable: true })
  hashtagLabels: string[];
  @Field({ nullable: true })
  dailyEmission: number;
}*/

@ObjectType()
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
@ObjectType()
export class TgChat extends Actor {
  @Prop({ type: TgChatMeta })
  meta: Typify<TgChatMeta>;
}

export const TgChatSchema = SchemaFactory.createForClass(TgChat);
export type TgChatDocument = Document & TgChat;
