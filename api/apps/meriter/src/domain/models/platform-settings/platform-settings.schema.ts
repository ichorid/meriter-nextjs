import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export const PLATFORM_SETTINGS_ID = 'platform';

export interface PlatformSettings {
  id: string;
  welcomeMeritsGlobal: number;
  /** Rubricator: allowed tags for OB feed filtering. Superadmin-managed. */
  availableFutureVisionTags?: string[];
  /** When true, prepend fixed decree 809 tags to the rubricator. */
  decree809Enabled?: boolean;
  /** Copy of canonical decree tags (seeded; not edited in UI). */
  decree809Tags?: string[];
  /** Bumped by migration when canonical list / legacy mappings change; see `DECREE_809_TAGS_REVISION`. */
  decree809TagsRevision?: number;
  /** Minimum entity count to show a tag in suggested list (default 5). */
  popularValueTagsThreshold?: number;
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

  @Prop({ type: Boolean, default: false })
  decree809Enabled?: boolean;

  @Prop({ type: [String], default: [] })
  decree809Tags?: string[];

  @Prop({ type: Number, required: false })
  decree809TagsRevision?: number;

  @Prop({ type: Number, default: 5 })
  popularValueTagsThreshold?: number;

  @Prop({ type: Number, required: false })
  demoSeedVersion?: number;

  updatedAt!: Date;
}

export type PlatformSettingsDocument = PlatformSettingsSchemaClass & Document;
export const PlatformSettingsSchema = SchemaFactory.createForClass(PlatformSettingsSchemaClass);
