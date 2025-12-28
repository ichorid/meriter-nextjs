import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FavoriteTargetType = 'publication' | 'poll' | 'project';

export interface Favorite {
  id: string;
  userId: string;
  targetType: FavoriteTargetType;
  targetId: string;
  /**
   * When the user last opened this favorite item (clears unread state).
   */
  lastViewedAt?: Date;
  /**
   * When this favorite item last had an update (comment/vote) that we track for unread/highlight.
   */
  lastActivityAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'favorites', timestamps: true })
export class FavoriteSchemaClass implements Favorite {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, enum: ['publication', 'poll', 'project'], index: true })
  targetType!: FavoriteTargetType;

  @Prop({ required: true, index: true })
  targetId!: string;

  @Prop()
  lastViewedAt?: Date;

  @Prop()
  lastActivityAt?: Date;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export const FavoriteSchema = SchemaFactory.createForClass(FavoriteSchemaClass);
export type FavoriteDocument = FavoriteSchemaClass & Document;

// Indexes for common queries
FavoriteSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
FavoriteSchema.index({ userId: 1, createdAt: -1 });
FavoriteSchema.index({ userId: 1, lastActivityAt: -1 });

