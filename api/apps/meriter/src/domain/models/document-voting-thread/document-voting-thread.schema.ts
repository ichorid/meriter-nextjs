import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseRawSchema } from 'mongoose';
import type { Document as MongooseDocument } from 'mongoose';

const ThreadRangeEmbeddedSchema = new MongooseRawSchema(
  {
    blockId: { type: String, required: true },
    rangeStart: { type: Number, required: true },
    rangeEnd: { type: Number, required: true },
  },
  { _id: false },
);

@Schema({ collection: 'document_voting_threads', timestamps: true })
export class DocumentVotingThreadSchemaClass {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  documentId!: string;

  @Prop({ enum: ['open', 'closed'], default: 'open', index: true })
  status!: 'open' | 'closed';

  @Prop({ required: true })
  anchorBlockId!: string;

  @Prop({ type: [ThreadRangeEmbeddedSchema], default: [] })
  ranges!: Array<{ blockId: string; rangeStart: number; rangeEnd: number }>;

  @Prop({ required: true })
  waveEndsAt!: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const DocumentVotingThreadSchema = SchemaFactory.createForClass(
  DocumentVotingThreadSchemaClass,
);
DocumentVotingThreadSchema.index({ documentId: 1, status: 1 });

export type DocumentVotingThreadDocument = MongooseDocument & DocumentVotingThreadSchemaClass;
