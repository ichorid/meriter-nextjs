import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type YougileProcessedEventDocument = YougileProcessedEvent & Document;

/**
 * Idempotency guard: one YouGile task produces at most one Meriter post per
 * integration, no matter how many times the webhook fires (retries, moving
 * the task out of and back into the done column).
 */
@Schema({ timestamps: true, collection: 'yougile_processed_events' })
export class YougileProcessedEvent {
  @Prop({ required: true })
  integrationId!: string;

  @Prop({ required: true })
  taskId!: string;

  /** Created publication id, when processing produced a post. */
  @Prop()
  publicationId?: string;

  createdAt!: Date;
}

export const YougileProcessedEventSchema = SchemaFactory.createForClass(
  YougileProcessedEvent,
);

YougileProcessedEventSchema.index(
  { integrationId: 1, taskId: 1 },
  { unique: true },
);
