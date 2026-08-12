import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UzzBankStatus =
  | 'awaiting_nominal'
  | 'active'
  | 'in_deal'
  | 'exhausted'
  | 'holding';

export interface UzzBankOwnerHistoryEntry {
  userId: string;
  at: Date;
  reason: string;
}

export interface UzzBank {
  id: string;
  communityId: string;
  ownerId: string;
  sourcePublicationId: string;
  hopsLeft: number;
  nominalRub: number | null;
  status: UzzBankStatus;
  ownerHistory: UzzBankOwnerHistoryEntry[];
  lastDemurrageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'uzz_banks', timestamps: true })
export class UzzBankSchemaClass implements Omit<UzzBank, 'createdAt' | 'updatedAt'> {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  communityId!: string;

  @Prop({ required: true, index: true })
  ownerId!: string;

  @Prop({ required: true, unique: true, index: true })
  sourcePublicationId!: string;

  @Prop({ required: true })
  hopsLeft!: number;

  @Prop({ type: Number, default: null })
  nominalRub!: number | null;

  @Prop({
    required: true,
    enum: ['awaiting_nominal', 'active', 'in_deal', 'exhausted', 'holding'],
    index: true,
  })
  status!: UzzBankStatus;

  @Prop({
    type: [
      {
        userId: { type: String, required: true },
        at: { type: Date, required: true },
        reason: { type: String, required: true },
      },
    ],
    default: [],
  })
  ownerHistory!: UzzBankOwnerHistoryEntry[];

  @Prop({ type: Date })
  lastDemurrageAt?: Date;
}

export const UzzBankSchema = SchemaFactory.createForClass(UzzBankSchemaClass);
export type UzzBankDocument = UzzBankSchemaClass &
  Document & { createdAt: Date; updatedAt: Date };

UzzBankSchema.index({ communityId: 1, status: 1 });
UzzBankSchema.index({ ownerId: 1, communityId: 1 });
