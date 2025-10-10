import { Document } from 'mongoose';
import { IAgreement } from '@common/abstracts/agreements/model/agreement.model';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectType } from '@nestjs/graphql';

export type AgreementDocument = Agreement & Document;

@ObjectType()
@Schema()
export class Agreement implements IAgreement {
  @Prop()
  domainName: string;
  @Prop()
  focusAssetUri: string;
  @Prop([String])
  initiatorsActorUris: string[];
  @Prop({ type: Object })
  meta: Record<string, unknown>;
  @Prop([String])
  relatedAssetsUris: string[];
  @Prop([String])
  signatures: string[];
  @Prop([String])
  spacesActorUris: string[];
  @Prop([String])
  subjectsActorUris: string[];

  @Prop()
  type: string;

  @Prop()
  uid: string;
  @Prop()
  value: number;

  @Prop(Date)
  createdAt: Date;
}

export const AgreementSchema = SchemaFactory.createForClass(Agreement);
