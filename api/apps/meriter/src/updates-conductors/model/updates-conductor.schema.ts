import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface UpdatesConductor {
  actorUri?: string;
  currencyOfTgChatId?: string;
  counterPlus: number;
  counterMinus: number;
  counterSum: number;
  publicationUids?: string[];
  commentsUids?: string[];
  votersActorUris?: string[];
  updateFrequencyMs?: number;
  nextUpdateAfter: Date;
}

@Schema()
export class UpdatesConductorSchemaClass implements UpdatesConductor {
  @Prop()
  actorUri?: string;

  @Prop()
  currencyOfTgChatId?: string;

  @Prop({ type: Number, default: 0 })
  counterPlus!: number;
  
  @Prop({ type: Number, default: 0 })
  counterMinus!: number;
  
  @Prop({ type: Number, default: 0 })
  counterSum!: number;

  @Prop()
  publicationUids?: string[];

  @Prop()
  commentsUids?: string[];

  @Prop()
  votersActorUris?: string[];

  @Prop({ type: Number })
  updateFrequencyMs?: number;

  @Prop({
    type: Date,
    default: () => new Date(),
  })
  nextUpdateAfter!: Date;
}

export type UpdatesConductorDocument = Document & UpdatesConductorSchemaClass;

export const UpdatesConductorSchema = SchemaFactory.createForClass(
  UpdatesConductorSchemaClass,
);
