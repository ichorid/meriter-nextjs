import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import graphqlTypeJson from 'graphql-type-json';
import { ICounter } from '../model/counter.interface';

export type CounterDocument = Counter & Document;

@ObjectType()
@Schema()
export class Counter implements ICounter {
  @Prop({ type: Number, default: 0 })
  value: number;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  @Prop({ type: Object })
  meta: Record<string, unknown>;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);
