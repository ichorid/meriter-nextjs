import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TransactionDocument = Transaction & Document;

@Schema({ collection: 'transactions', timestamps: true })
export class Transaction {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  walletId: string;

  @Prop({ required: true })
  type: 'vote' | 'comment' | 'poll_cast' | 'withdrawal' | 'deposit';

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  description: string;

  @Prop()
  referenceType?: string;

  @Prop()
  referenceId?: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  updatedAt: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

// Add indexes for common queries
TransactionSchema.index({ walletId: 1 });
TransactionSchema.index({ type: 1 });
TransactionSchema.index({ referenceType: 1, referenceId: 1 });
TransactionSchema.index({ createdAt: -1 });