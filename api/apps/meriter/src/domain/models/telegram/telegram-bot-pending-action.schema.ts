import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TelegramBotPendingActionType =
  | 'confirm_vote_amount'
  | 'confirm_transfer'
  | 'onboarding_name'
  | 'onboarding_quota_enabled'
  | 'onboarding_quota_amount'
  | 'onboarding_hashtag'
  | 'onboarding_post_cost'
  | 'onboarding_moderation'
  | 'onboarding_welcome_merits'
  | 'onboarding_confirm';

@Schema({ collection: 'telegram_bot_pending_actions', timestamps: true })
export class TelegramBotPendingActionSchemaClass {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  telegramUserId!: string;

  @Prop({ required: true })
  action!: TelegramBotPendingActionType;

  @Prop({ type: Object, default: {} })
  payload!: Record<string, unknown>;

  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export const TelegramBotPendingActionSchema = SchemaFactory.createForClass(
  TelegramBotPendingActionSchemaClass,
);
export type TelegramBotPendingActionDocument = TelegramBotPendingActionSchemaClass & Document;

TelegramBotPendingActionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
