import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export const PLATFORM_SETTINGS_ID = 'platform';

export interface PlatformSettings {
  id: string;
  welcomeMeritsGlobal: number;
  /** Rubricator: allowed tags for OB feed filtering. Superadmin-managed. */
  availableFutureVisionTags?: string[];
  /** Set after demo seed; cleared on platform wipe. */
  demoSeedVersion?: number;
  updatedAt: Date;
}

@Schema({ collection: 'platform_settings', timestamps: true })
export class PlatformSettingsSchemaClass implements PlatformSettings {
  @Prop({ required: true, unique: true, default: PLATFORM_SETTINGS_ID })
  id!: string;

  @Prop({ required: true, default: 0 })
  welcomeMeritsGlobal!: number;

  @Prop({ type: [String], default: [] })
  availableFutureVisionTags?: string[];

  @Prop({ type: Number, required: false })
  demoSeedVersion?: number;

  updatedAt!: Date;
}

export type PlatformSettingsDocument = PlatformSettingsSchemaClass & Document;
export const PlatformSettingsSchema = SchemaFactory.createForClass(PlatformSettingsSchemaClass);
