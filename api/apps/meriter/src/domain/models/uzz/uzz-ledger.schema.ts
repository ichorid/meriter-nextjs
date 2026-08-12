import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface UzzLedger {
  id: string;
  communityId: string;
  type: string;
  payload: Record<string, unknown>;
  userId?: string;
  bankId?: string;
  dealId?: string;
  createdAt: Date;
}

@Schema({ collection: 'uzz_ledger', timestamps: { createdAt: true, updatedAt: false } })
export class UzzLedgerSchemaClass implements Omit<UzzLedger, 'createdAt'> {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  communityId!: string;

  @Prop({ required: true, index: true })
  type!: string;

  @Prop({ type: Object, required: true, default: {} })
  payload!: Record<string, unknown>;

  @Prop({ index: true })
  userId?: string;

  @Prop({ index: true })
  bankId?: string;

  @Prop({ index: true })
  dealId?: string;
}

export const UzzLedgerSchema = SchemaFactory.createForClass(UzzLedgerSchemaClass);
export type UzzLedgerDocument = UzzLedgerSchemaClass & Document & { createdAt: Date };

UzzLedgerSchema.index({ communityId: 1, createdAt: -1 });
