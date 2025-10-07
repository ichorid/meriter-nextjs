import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class UpdatesConductor {
  @Prop()
  actorUri: string;

  @Prop()
  currencyOfTgChatId: string;

  @Prop({ type: Number, default: 0 })
  counterPlus: number;
  @Prop({ type: Number, default: 0 })
  counterMinus: number;
  @Prop({ type: Number, default: 0 })
  counterSum: number;

  @Prop()
  publicationUids: string[];

  @Prop()
  commentsUids: string[];

  @Prop()
  votersActorUris: string[];

  @Prop({ type: Number })
  updateFrequencyMs: number;

  @Prop({
    type: Date,
  })
  nextUpdateAfter: Date;
}
export type UpdatesConductorDocument = Document & UpdatesConductor;

export const UpdatesConductorSchema = SchemaFactory.createForClass(
  UpdatesConductor,
);
