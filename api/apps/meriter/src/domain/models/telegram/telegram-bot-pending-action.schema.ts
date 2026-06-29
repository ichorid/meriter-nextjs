import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TelegramBotPendingActionType =
  | 'confirm_vote_amount'
  | 'onboarding_name'
  | 'onboarding_platform_integration'
  | 'onboarding_platform_visibility'
  | 'onboarding_future_vision'
  | 'onboarding_quota_enabled'
  | 'onboarding_quota_amount'
  | 'onboarding_hashtag'
  | 'onboarding_post_cost'
  | 'onboarding_moderation'
  | 'onboarding_publication_ack'
  | 'onboarding_welcome_merits'
  | 'onboarding_confirm'
  | 'settings_edit_name'
  | 'settings_edit_quota'
  | 'settings_edit_post_cost'
  | 'settings_edit_hashtag'
  | 'settings_edit_welcome_merits';

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
