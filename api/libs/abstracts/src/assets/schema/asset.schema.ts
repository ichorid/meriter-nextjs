import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import { IAsset } from '@common/abstracts/assets/model/asset.interface';

export type AssetDocument = Asset & Document;

@Schema()
export class Asset implements IAsset {
  @Prop()
  shortUid: string;

  @Prop()
  longUid: string;

  @Prop({ type: Object })
  payload: Record<string, unknown>;

  @Prop({ type: Object })
  meta: Record<string, unknown>;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  @Prop([String])
  deleteableWithTags: string[];
  @Prop()
  domainName: string;

  @Prop([String])
  editableWithTags: string[];
  @Prop()
  extFileUri: string;
  @Prop()
  extUri: string;
  @Prop({ type: Object })
  protoContent: Record<string, any>;

  @Prop()
  uid: string;

  @Prop([String])
  viewableWithTags: string[];
}

export const AssetSchema = SchemaFactory.createForClass(Asset);
