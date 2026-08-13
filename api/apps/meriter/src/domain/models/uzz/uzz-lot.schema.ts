import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface UzzLot {
  id: string;
  communityId: string;
  authorId: string;
  title: string;
  description: string;
  priceRub: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'uzz_lots', timestamps: true })
export class UzzLotSchemaClass implements Omit<UzzLot, 'createdAt' | 'updatedAt'> {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  communityId!: string;

  @Prop({ required: true, index: true })
  authorId!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ required: true })
  priceRub!: number;

  @Prop({ required: true, default: true, index: true })
  active!: boolean;
}

export const UzzLotSchema = SchemaFactory.createForClass(UzzLotSchemaClass);
export type UzzLotDocument = UzzLotSchemaClass &
  Document & { createdAt: Date; updatedAt: Date };

UzzLotSchema.index({ communityId: 1, active: 1, createdAt: -1 });
UzzLotSchema.index({ authorId: 1, communityId: 1 });
