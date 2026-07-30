import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type YougileIntegrationDocument = YougileIntegration & Document;

export type YougileEventLogStatus =
  | 'post_created'
  | 'user_not_found'
  | 'duplicate'
  | 'column_mismatch'
  | 'no_assignee'
  | 'error';

export interface YougileEventLogEntry {
  at: Date;
  status: YougileEventLogStatus;
  taskId?: string;
  taskTitle?: string;
  detail?: string;
}

/**
 * YouGile integration config for one community (variant A2):
 * task moved to the "done" column -> auto-post in targetCommunityId on behalf
 * of the task assignee (mapped by email). API key never leaves the server.
 */
@Schema({ timestamps: true, collection: 'yougile_integrations' })
export class YougileIntegration {
  @Prop({ required: true, unique: true, index: true })
  communityId!: string;

  @Prop({ required: true })
  apiKey!: string;

  /** Random URL token protecting the webhook endpoint (YouGile has no HMAC). */
  @Prop({ required: true })
  webhookSecret!: string;

  /** YouGile webhook subscription id (set after configure). */
  @Prop()
  webhookId?: string;

  @Prop()
  boardId?: string;

  @Prop()
  boardTitle?: string;

  /** Column meaning "task done". */
  @Prop()
  columnId?: string;

  @Prop()
  columnTitle?: string;

  /** Community to post into. Defaults to communityId. */
  @Prop()
  targetCommunityId?: string;

  @Prop({ default: false })
  enabled!: boolean;

  /** User who connected the integration (for audit). */
  @Prop()
  connectedByUserId?: string;

  /** Rolling log of recent webhook processing outcomes (capped). */
  @Prop({ type: Array, default: [] })
  eventLog!: YougileEventLogEntry[];

  createdAt!: Date;
  updatedAt!: Date;
}

export const YougileIntegrationSchema =
  SchemaFactory.createForClass(YougileIntegration);
