export const PLATFORM_SETTINGS_PERSISTENCE_PORT = Symbol('PLATFORM_SETTINGS_PERSISTENCE_PORT');

export const PLATFORM_SETTINGS_RECORD_ID = 'platform';

export interface PlatformSettingsRecord {
  id: string;
  welcomeMeritsGlobal: number;
  availableFutureVisionTags?: string[];
  decree809Enabled?: boolean;
  decree809Tags?: string[];
  decree809TagsRevision?: number;
  collaborativeDocumentsMigrationRevision?: number;
  popularValueTagsThreshold?: number;
  demoSeedVersion?: number;
  entrepreneursDemoPack?: {
    version: number;
    communityId: string;
    seededAt: string;
  };
  demoPersonasEnabled?: boolean;
  updatedAt: Date;
}

export interface PlatformSettingsBootstrapInput {
  welcomeMeritsGlobal: number;
  availableFutureVisionTags: string[];
  decree809Enabled: boolean;
  decree809Tags: string[];
  decree809TagsRevision: number;
  popularValueTagsThreshold: number;
}

export interface PlatformSettingsUpdateSet {
  welcomeMeritsGlobal?: number;
  availableFutureVisionTags?: string[];
  decree809Enabled?: boolean;
  decree809Tags?: string[];
  decree809TagsRevision?: number;
  popularValueTagsThreshold?: number;
  demoSeedVersion?: number;
  entrepreneursDemoPack?: {
    version: number;
    communityId: string;
    seededAt: string;
  };
  demoPersonasEnabled?: boolean;
  updatedAt?: Date;
}

/**
 * PlatformSettingsPersistencePort — singleton platform config document (V-12).
 */
export interface PlatformSettingsPersistencePort {
  findById(id: string): Promise<PlatformSettingsRecord | null>;

  createWithBootstrap(input: PlatformSettingsBootstrapInput): Promise<PlatformSettingsRecord>;

  updateById(id: string, set: PlatformSettingsUpdateSet): Promise<PlatformSettingsRecord | null>;

  updateWithUpsert(
    id: string,
    set: PlatformSettingsUpdateSet,
    setOnInsert?: PlatformSettingsBootstrapInput,
  ): Promise<PlatformSettingsRecord | null>;

  unsetFields(id: string, fields: string[]): Promise<void>;

  resetAfterPlatformWipe(
    id: string,
    set: PlatformSettingsUpdateSet,
  ): Promise<void>;
}
