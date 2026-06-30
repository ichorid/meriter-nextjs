import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import type { TappalkaChoiceResult } from '@meriter/shared-types';

export type TappalkaSessionStatus = 'pending' | 'processing' | 'consumed';

export interface TappalkaSession {
  id: string;
  userId: string;
  communityId: string;
  postAId: string;
  postBId: string;
  status: TappalkaSessionStatus;
  expiresAt: Date;
  consumedAt?: Date;
  storedResult?: TappalkaChoiceResult;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'tappalka_sessions', timestamps: true })
export class TappalkaSessionSchemaClass implements TappalkaSession {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, index: true })
  communityId!: string;

  @Prop({ required: true })
  postAId!: string;

  @Prop({ required: true })
  postBId!: string;

  @Prop({ required: true, enum: ['pending', 'processing', 'consumed'], default: 'pending' })
  status!: TappalkaSessionStatus;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ type: Date })
  consumedAt?: Date;

  @Prop({ type: Object })
  storedResult?: TappalkaChoiceResult;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export const TappalkaSessionSchema =
  SchemaFactory.createForClass(TappalkaSessionSchemaClass);
export type TappalkaSessionDocument = TappalkaSessionSchemaClass & Document;

TappalkaSessionSchema.index({ userId: 1, communityId: 1, status: 1 });
TappalkaSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
