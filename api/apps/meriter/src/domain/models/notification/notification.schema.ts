import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

export type NotificationType =
  | 'vote'
  | 'beneficiary'
  | 'mention'
  | 'reply'
  | 'comment'
  | 'publication'
  | 'poll'
  | 'system'
  | 'quota';

export type NotificationSource = 'user' | 'system' | 'community';

export interface NotificationMetadata {
  [key: string]: any;
}

@Schema({ collection: 'notifications', timestamps: true })
export class Notification {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true, index: true })
  userId: string; // recipient

  @Prop({
    required: true,
    enum: ['vote', 'beneficiary', 'mention', 'reply', 'comment', 'publication', 'poll', 'system', 'quota'],
    index: true,
  })
  type: NotificationType;

  @Prop({
    required: true,
    enum: ['user', 'system', 'community'],
  })
  source: NotificationSource;

  @Prop()
  sourceId?: string; // ID of the source (user/community)

  @Prop({ type: Object, required: true })
  metadata: NotificationMetadata;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true, default: false, index: true })
  read: boolean;

  @Prop()
  readAt?: Date;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Compound indexes for efficient queries
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, read: 1 });

