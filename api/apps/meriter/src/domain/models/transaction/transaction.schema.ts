import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TransactionDocument = Transaction & Document;

@Schema({ collection: 'transactions', timestamps: true })
export class Transaction {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  walletId: string;

  @Prop({ required: true, enum: ['credit', 'debit'] })
  type: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: ['personal', 'quota'] })
  sourceType: string;

  @Prop({ required: true })
  referenceType: string;

  @Prop({ required: true })
  referenceId: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  createdAt: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

// Add indexes for common queries
TransactionSchema.index({ walletId: 1, createdAt: -1 });
TransactionSchema.index({ referenceType: 1, referenceId: 1 });
