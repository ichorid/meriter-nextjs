import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Category Mongoose Schema
 * 
 * Categories are predefined tags that can be assigned to publications.
 * Only superadmins can manage categories.
 */

export interface Category {
  id: string;
  name: string; // Display name (e.g., "Социум", "Животные")
  slug: string; // URL-friendly identifier (e.g., "socium", "animals")
  order: number; // Display order
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'categories', timestamps: true })
export class CategorySchemaClass implements Category {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, unique: true, maxlength: 100 })
  name!: string;

  @Prop({ required: true, unique: true, maxlength: 100 })
  slug!: string;

  @Prop({ required: true, default: 0 })
  order!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export type CategoryDocument = CategorySchemaClass & Document;
export const CategorySchema = SchemaFactory.createForClass(CategorySchemaClass);

// Create index for faster queries
CategorySchema.index({ slug: 1 });
CategorySchema.index({ order: 1 });


