import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseRawSchema } from 'mongoose';
import type { Document as MongooseDocument } from 'mongoose';

/**
 * Collaborative document (ОБ, описание проекта, или кастомный).
 * Collection name `documents` — см. docs/prd/shared-document/business-approved-tz.md
 */

export type MeriterDocType = 'imageOfFuture' | 'description' | 'custom';

export type MeriterDocApplyMode = 'manual' | 'auto';

export type OfficialContentReason = 'vote' | 'admin' | 'initial';

const EditHistoryEntrySchema = new MongooseRawSchema(
  {
    changedAt: { type: Date, required: true },
    changedBy: { type: String, required: true },
    reason: { type: String, enum: ['initial', 'vote', 'admin'], required: true },
    variantId: { type: String },
    previousContent: { type: String, required: true },
  },
  { _id: false },
);

const BlockEmbeddedSchema = new MongooseRawSchema(
  {
    id: { type: String, required: true },
    order: { type: Number, required: true },
    blockType: {
      type: String,
      enum: ['paragraph', 'heading', 'list-bullet', 'list-numbered', 'quote'],
      required: true,
    },
    officialContent: { type: String, default: '' },
    officialContentSetAt: { type: Date },
    officialContentSetBy: { type: String },
    officialContentReason: {
      type: String,
      enum: ['vote', 'admin', 'initial'],
    },
    officialContentVariantId: { type: String },
    /** When true, members cannot propose variants for this block (admins may still propose). */
    proposalsLocked: { type: Boolean, default: false },
    /** UTF-16 plain-text spans where proposals are forbidden (sub-block pin). */
    lockedRanges: {
      type: [
        {
          rangeStart: { type: Number, required: true },
          rangeEnd: { type: Number, required: true },
        },
      ],
      default: [],
    },
    /** Voting wave anchor — см. ТЗ §13.3 */
    currentWaveStartedAt: { type: Date },
    /** Weighted vote total for keeping current official text during an open wave. */
    officialRating: { type: Number, default: 0 },
    editHistory: { type: [EditHistoryEntrySchema], default: [] },
  },
  { _id: false },
);

const SectionEmbeddedSchema = new MongooseRawSchema(
  {
    id: { type: String, required: true },
    title: { type: String, default: '' },
    order: { type: Number, required: true },
    blocks: { type: [BlockEmbeddedSchema], default: [] },
  },
  { _id: false },
);

@Schema({ collection: 'documents', timestamps: true })
export class MeriterDocumentSchemaClass {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true })
  communityId!: string;

  @Prop({
    required: true,
    enum: ['imageOfFuture', 'description', 'custom'],
  })
  type!: MeriterDocType;

  @Prop({ required: true })
  title!: string;

  @Prop({ type: [SectionEmbeddedSchema], default: [] })
  sections!: unknown[];

  @Prop({ enum: ['manual', 'auto'], default: 'manual' })
  mode!: MeriterDocApplyMode;

  @Prop({ default: 48 })
  votingDurationHours!: number;

  @Prop({ default: 1 })
  variantCost!: number;

  @Prop({ default: true })
  allowDownvotes!: boolean;

  @Prop({ required: true })
  createdBy!: string;

  @Prop({ enum: ['active', 'archived'], default: 'active' })
  status!: 'active' | 'archived';

  @Prop({ default: false })
  deleted!: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export const MeriterDocumentSchema = SchemaFactory.createForClass(MeriterDocumentSchemaClass);
export type MeriterDocumentDocument = MeriterDocumentSchemaClass & MongooseDocument;

MeriterDocumentSchema.index(
  { communityId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deleted: false,
      type: { $in: ['imageOfFuture', 'description'] },
    },
  },
);
