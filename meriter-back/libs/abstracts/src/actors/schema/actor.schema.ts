import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import graphqlTypeJson from 'graphql-type-json';
import { IActor } from '../model/actor.interface';

export type ActorDocument = Actor & Document;

@ObjectType()
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

@ObjectType()
@Schema()
class TagRecord {
  @Field()
  @Prop({ type: Date })
  expiresAt: Date;

  @Field()
  @Prop({ type: Date })
  createdAt: Date;

  @Field()
  @Prop()
  value: string;
}

const TagRecordSchemaType = SchemaFactory.createForClass(TagRecord);

@ObjectType()
@Schema()
class LogRecord {
  @Field()
  @Prop()
  type: 'auth' | 'payment-success' | 'refund' | 'add-contact';

  @Field()
  @Prop({ type: Date })
  ts: Date;

  @Field()
  @Prop()
  record: string;
}

const LogRecordSchemaType = SchemaFactory.createForClass(LogRecord);

@ObjectType()
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
