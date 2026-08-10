import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TelegramChatMemberDirectorySource =
  | 'message'
  | 'chat_member'
  | 'new_chat_members'
  | 'admin_sync'
  | 'reply'
  | 'text_mention'
  | 'getChat';

export interface TelegramChatMemberDirectoryEntry {
  id: string;
  telegramChatId: string;
  telegramUserId: string;
  username?: string;
  usernameLower?: string;
  firstName?: string;
  lastName?: string;
  lastSeenAt: Date;
  lastSource: TelegramChatMemberDirectorySource;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'telegram_chat_member_directory', timestamps: true })
export class TelegramChatMemberDirectorySchemaClass implements TelegramChatMemberDirectoryEntry {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  telegramChatId!: string;

  @Prop({ required: true, index: true })
  telegramUserId!: string;

  @Prop()
  username?: string;

  @Prop({ index: true })
  usernameLower?: string;

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop({ required: true })
  lastSeenAt!: Date;

  @Prop({ required: true })
  lastSource!: TelegramChatMemberDirectorySource;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export const TelegramChatMemberDirectorySchema = SchemaFactory.createForClass(
  TelegramChatMemberDirectorySchemaClass,
);
export type TelegramChatMemberDirectoryDocument = TelegramChatMemberDirectorySchemaClass &
  Document;

TelegramChatMemberDirectorySchema.index(
  { telegramChatId: 1, telegramUserId: 1 },
  { unique: true },
);
TelegramChatMemberDirectorySchema.index(
  { telegramChatId: 1, usernameLower: 1 },
  {
    unique: true,
    partialFilterExpression: { usernameLower: { $type: 'string' } },
  },
);
TelegramChatMemberDirectorySchema.index({ usernameLower: 1, lastSeenAt: -1 });
