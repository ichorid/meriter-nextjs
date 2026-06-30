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

  @Prop({ required: true })
  content!: string;

  @Prop({ type: [ReferenceEmbeddedSchema], default: [] })
  references!: unknown[];

  @Prop({ required: true })
  proposedBy!: string;

  @Prop({ required: true })
  proposedAt!: Date;

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
