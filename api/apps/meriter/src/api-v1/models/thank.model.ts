import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ThankDocument = Thank & Document;

@Schema({ timestamps: true })
export class Thank {
  @Prop({ required: true, unique: true })
  uid: string;

  @Prop({ required: true, enum: ['publication', 'comment'] })
  targetType: string;

  @Prop({ required: true })
  targetId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: ['personal', 'daily_quota'] })
  sourceType: string;

  @Prop({ required: true })
  communityId: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const ThankSchema = SchemaFactory.createForClass(Thank);

// Add indexes for better performance
ThankSchema.index({ targetType: 1, targetId: 1, userId: 1 }, { unique: true });
ThankSchema.index({ userId: 1, createdAt: -1 });
ThankSchema.index({ communityId: 1, createdAt: -1 });
ThankSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
