import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export const PLATFORM_SETTINGS_ID = 'platform';

export interface PlatformSettings {
  id: string;
  welcomeMeritsGlobal: number;
  updatedAt: Date;
}

@Schema({ collection: 'platform_settings', timestamps: true })
export class PlatformSettingsSchemaClass implements PlatformSettings {
  @Prop({ required: true, unique: true, default: PLATFORM_SETTINGS_ID })
  id!: string;

  @Prop({ required: true, default: 0 })
  welcomeMeritsGlobal!: number;

  updatedAt!: Date;
}

export type PlatformSettingsDocument = PlatformSettingsSchemaClass & Document;
export const PlatformSettingsSchema = SchemaFactory.createForClass(PlatformSettingsSchemaClass);
