import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface AboutCategory {
  id: string;
  title: string;
  description?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'about_categories', timestamps: true })
export class AboutCategorySchemaClass implements AboutCategory {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, maxlength: 200 })
  title!: string;

  @Prop({ maxlength: 500 })
  description?: string;

  @Prop({ required: true, default: 0 })
  order!: number;
}

export type AboutCategoryDocument = AboutCategory & Document;
export const AboutCategorySchema = SchemaFactory.createForClass(AboutCategorySchemaClass);

