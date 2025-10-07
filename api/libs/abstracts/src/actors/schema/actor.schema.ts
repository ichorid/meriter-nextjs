import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IActor } from '../model/actor.interface';

export type ActorDocument = Actor & Document;

@Schema()
class DisplayProfile {
  @Prop()
  name?: string;
  @Prop()
  description?: string;
  @Prop()
  avatarUrl?: string;
  @Prop()
  scope?: string;
}

const DisplayProfileSchemaType = SchemaFactory.createForClass(DisplayProfile);

@Schema()
class TagRecord {
  @Prop({ type: Date })
  expiresAt: Date;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop()
  value: string;
}

const TagRecordSchemaType = SchemaFactory.createForClass(TagRecord);

@Schema()
class LogRecord {
  @Prop()
  type: 'auth' | 'payment-success' | 'refund' | 'add-contact';

  @Prop({ type: Date })
  ts: Date;

  @Prop()
  record: string;
}

const LogRecordSchemaType = SchemaFactory.createForClass(LogRecord);

@Schema()
export class Actor implements IActor {
  @Prop()
  domainName: string;

  @Prop()
  uid: string;

  @Prop()
  token: string;

  @Prop({ type: [String] })
  identities: string[];

  @Prop({ type: [String], default: undefined })
  administrators: string[];

  @Prop({ type: Object })
  meta: Record<string, unknown>;

  @Prop({ type: [TagRecordSchemaType] })
  tagRecords: TagRecord[];

  @Prop({ type: [String] })
  tags: string[];

  @Prop()
  slug: string;

  @Prop(Boolean)
  deleted: boolean;

  @Prop({ type: [LogRecordSchemaType] })
  logs: LogRecord[];

  @Prop({ type: DisplayProfileSchemaType })
  profile: DisplayProfile;

  @Prop({ type: [DisplayProfileSchemaType], default: undefined })
  profiles: DisplayProfile[];
}

export const ActorSchema = SchemaFactory.createForClass(Actor);
