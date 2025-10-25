import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CommunityDocument = Community & Document;

@Schema({ collection: 'communities', timestamps: true })
export class Community {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  telegramChatId: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ type: [String], default: [] })
  administrators: string[];

  @Prop({ type: [String], default: [] })
  members: string[];

  @Prop({
    type: {
      iconUrl: String,
      currencyNames: {
        singular: { type: String, default: 'merit' },
        plural: { type: String, default: 'merits' },
        genitive: { type: String, default: 'merits' },
      },
      dailyEmission: { type: Number, default: 10 },
    },
    default: {},
  })
  settings: {
    iconUrl?: string;
    currencyNames: {
      singular: string;
      plural: string;
      genitive: string;
    };
    dailyEmission: number;
  };

  @Prop({ type: [String], default: [] })
  hashtags: string[];

  @Prop({ type: [String], default: [] })
  spaces: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  updatedAt: Date;
}

export const CommunitySchema = SchemaFactory.createForClass(Community);

// Add indexes for common queries
CommunitySchema.index({ telegramChatId: 1 }, { unique: true });
CommunitySchema.index({ administrators: 1 });
CommunitySchema.index({ isActive: 1 });