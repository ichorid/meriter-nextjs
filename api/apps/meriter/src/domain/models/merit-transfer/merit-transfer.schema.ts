import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MeritTransferWalletType = 'global' | 'community' | 'project';

export interface MeritTransfer {
  id: string;
  senderId: string;
  receiverId: string;
  amount: number;
  comment?: string;
  sourceWalletType: MeritTransferWalletType;
  sourceContextId?: string;
  targetWalletType: MeritTransferWalletType;
  targetContextId?: string;
  communityContextId: string;
  eventPostId?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'merit_transfers', timestamps: true })
export class MeritTransferSchemaClass implements MeritTransfer {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  senderId!: string;

  @Prop({ required: true, index: true })
  receiverId!: string;

  @Prop({ required: true })
  amount!: number;

  @Prop()
  comment?: string;

  @Prop({ required: true, enum: ['global', 'community', 'project'] })
  sourceWalletType!: MeritTransferWalletType;

  @Prop()
  sourceContextId?: string;

  @Prop({ required: true, enum: ['global', 'community', 'project'] })
  targetWalletType!: MeritTransferWalletType;

  @Prop()
  targetContextId?: string;

  @Prop({ required: true, index: true })
  communityContextId!: string;

  @Prop({ index: true })
  eventPostId?: string;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export const MeritTransferSchema = SchemaFactory.createForClass(MeritTransferSchemaClass);
export type MeritTransferDocument = MeritTransferSchemaClass & Document;

MeritTransferSchema.index({ communityContextId: 1, createdAt: -1 });
MeritTransferSchema.index({ senderId: 1, createdAt: -1 });
MeritTransferSchema.index({ receiverId: 1, createdAt: -1 });
