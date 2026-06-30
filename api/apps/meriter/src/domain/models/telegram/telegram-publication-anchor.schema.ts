import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TelegramPublicationAnchorType = 'bot_mirror' | 'hashtag' | 'vote_panel';

export interface TelegramPublicationAnchor {
  id: string;
  communityId: string;
  telegramChatId: string;
  telegramMessageId: number;
  publicationId: string;
  anchorType: TelegramPublicationAnchorType;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'telegram_publication_anchors', timestamps: true })
export class TelegramPublicationAnchorSchemaClass implements TelegramPublicationAnchor {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  communityId!: string;

  @Prop({ required: true, index: true })
  telegramChatId!: string;

  @Prop({ required: true })
  telegramMessageId!: number;

  @Prop({ required: true, index: true })
  publicationId!: string;

  @Prop({ required: true, enum: ['bot_mirror', 'hashtag', 'vote_panel'] })
  anchorType!: TelegramPublicationAnchorType;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export const TelegramPublicationAnchorSchema = SchemaFactory.createForClass(
  TelegramPublicationAnchorSchemaClass,
);
export type TelegramPublicationAnchorDocument = TelegramPublicationAnchorSchemaClass & Document;

TelegramPublicationAnchorSchema.index(
  { telegramChatId: 1, telegramMessageId: 1 },
  { unique: true },
);
