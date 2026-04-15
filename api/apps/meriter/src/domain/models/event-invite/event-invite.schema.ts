import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * RSVP invite link for an event publication (`postType === 'event'`).
 * Token is the secret segment in the invite URL; usage limits enforced in service (BE-7a).
 */
export interface EventInvite {
  id: string;
  eventPostId: string;
  token: string;
  /** null / undefined = unlimited uses */
  maxUses?: number | null;
  usedCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date | null;
}

@Schema({ collection: 'event_invites', timestamps: true })
export class EventInviteSchemaClass implements Omit<EventInvite, 'createdAt' | 'updatedAt'> {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  eventPostId!: string;

  @Prop({ required: true, unique: true })
  token!: string;

  @Prop({ type: Number, default: null })
  maxUses?: number | null;

  @Prop({ required: true, default: 0 })
  usedCount!: number;

  @Prop({ required: true })
  createdBy!: string;

  @Prop({ type: Date, default: undefined })
  expiresAt?: Date | null;
}

export const EventInviteSchema = SchemaFactory.createForClass(EventInviteSchemaClass);
export type EventInviteDocument = EventInviteSchemaClass &
  Document & { createdAt: Date; updatedAt: Date };
