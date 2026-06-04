import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseRawSchema } from 'mongoose';
import type { Document as MongooseDocument } from 'mongoose';

const ReferenceEmbeddedSchema = new MongooseRawSchema(
  {
    id: { type: String, required: true },
    url: { type: String, required: true },
    summary: { type: String, required: true },
    stance: { type: String, enum: ['pro', 'con'], required: false },
  },
  { _id: false },
);

const VariantInsertBlockEmbeddedSchema = new MongooseRawSchema(
  {
    blockType: { type: String, required: true },
    officialContent: { type: String, required: true },
  },
  { _id: false },
);

const VariantPatchEmbeddedSchema = new MongooseRawSchema(
  {
    blockId: { type: String, required: true },
    rangeStart: { type: Number, required: true },
    rangeEnd: { type: Number, required: true },
    proposedText: { type: String, default: '' },
    previewContent: { type: String, required: true },
    insertAfterBlockId: { type: String, required: false },
    insertBlocks: { type: [VariantInsertBlockEmbeddedSchema], default: undefined },
  },
  { _id: false },
);

/**
 * Предложенный вариант текста блока документа.
 * Коллекция `document_block_variants` — см. business-approved-tz.md §4.4
 */
@Schema({ collection: 'document_block_variants', timestamps: true })
export class DocumentBlockVariantSchemaClass {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true })
  documentId!: string;

  @Prop({ required: true })
  blockId!: string;

  /** Groups overlapping proposals into one voting wave (v3). */
  @Prop()
  votingThreadId?: string;

  /**
   * `block` — single-block variant (legacy fields mirror one patch).
   * `patches` — multi-block edit; only `patches[]` stores per-block data.
   */
  @Prop({ enum: ['block', 'patches'], default: 'block' })
  proposalScope!: 'block' | 'patches';

  @Prop({ type: [VariantPatchEmbeddedSchema], default: [] })
  patches!: Array<{
    blockId: string;
    rangeStart: number;
    rangeEnd: number;
    proposedText: string;
    previewContent: string;
    insertAfterBlockId?: string;
    insertBlocks?: Array<{ blockType: string; officialContent: string }>;
  }>;

  @Prop({ required: true })
  content!: string;

  /** Sub-block range start (UTF-16 plain text index in official block). */
  @Prop()
  rangeStart?: number;

  /** Sub-block range end (exclusive). */
  @Prop()
  rangeEnd?: number;

  /** Proposed replacement for the range (sanitized HTML). */
  @Prop()
  proposedText?: string;

  /** Hash of official plain text at propose time (stale apply warning). */
  @Prop()
  officialTextHashAtPropose?: string;

  @Prop({ type: [ReferenceEmbeddedSchema], default: [] })
  references!: unknown[];

  @Prop({ required: true })
  proposedBy!: string;

  @Prop({ required: true })
  proposedAt!: Date;

  /** Optional rationale from proposer (shown in proposal rail). */
  @Prop({ maxlength: 500 })
  proposerComment?: string;

  @Prop({
    enum: ['open', 'closed-winner', 'closed-not-winner', 'applied', 'withdrawn'],
    default: 'open',
  })
  status!:
    | 'open'
    | 'closed-winner'
    | 'closed-not-winner'
    | 'applied'
    | 'withdrawn';

  @Prop({ default: 0 })
  rating!: number;

  @Prop()
  appliedAt?: Date;

  @Prop()
  appliedBy?: string;

  @Prop({ default: 0 })
  costPaid!: number;

  @Prop({ default: false })
  deleted!: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export const DocumentBlockVariantSchema = SchemaFactory.createForClass(
  DocumentBlockVariantSchemaClass,
);
export type DocumentBlockVariantDocument = DocumentBlockVariantSchemaClass &
  MongooseDocument;

DocumentBlockVariantSchema.index({ documentId: 1, blockId: 1, status: 1 });
DocumentBlockVariantSchema.index({ documentId: 1, blockId: 1, rating: -1 });
DocumentBlockVariantSchema.index({ proposedAt: 1 });
