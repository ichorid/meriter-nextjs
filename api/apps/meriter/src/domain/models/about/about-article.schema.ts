import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface AboutArticle {
  id: string;
  categoryId: string;
  title: string;
  content: string; // HTML content from WYSIWYG editor
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'about_articles', timestamps: true })
export class AboutArticleSchemaClass implements AboutArticle {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true })
  categoryId!: string;

  @Prop({ required: true, maxlength: 200 })
  title!: string;

  @Prop({ required: true, type: String })
  content!: string;

  @Prop({ required: true, default: 0 })
  order!: number;
}

export type AboutArticleDocument = AboutArticle & Document;
export const AboutArticleSchema = SchemaFactory.createForClass(AboutArticleSchemaClass);

