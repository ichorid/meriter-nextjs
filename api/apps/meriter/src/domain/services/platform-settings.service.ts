import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  PlatformSettings,
  PLATFORM_SETTINGS_ID,
} from '../models/platform-settings/platform-settings.schema';
import { PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP } from '../common/constants/platform-bootstrap.constants';
import { DECREE_809_TAGS } from '@meriter/shared-types/value-rubricator';
import { DECREE_809_TAGS_REVISION } from '@meriter/shared-types/decree809-tag-remap';
import { loadDevPlatformSnapshot } from '../../seed-data/load-dev-platform-snapshot';
import {
  PLATFORM_SETTINGS_PERSISTENCE_PORT,
  type PlatformSettingsPersistencePort,
  type PlatformSettingsBootstrapInput,
} from '../ports/platform-settings.persistence.port';

export interface UpdatePlatformSettingsDto {
  welcomeMeritsGlobal?: number;
}

@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);

  constructor(
    @Inject(PLATFORM_SETTINGS_PERSISTENCE_PORT)
    private readonly platformSettingsPersistence: PlatformSettingsPersistencePort,
  ) {}

  private getBootstrapInput(): PlatformSettingsBootstrapInput {
    return {
      welcomeMeritsGlobal: PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.welcomeMeritsGlobal,
      availableFutureVisionTags: [
        ...PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.availableFutureVisionTags,
      ],
      decree809Enabled: PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.decree809Enabled,
      decree809Tags: [...PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.decree809Tags],
      decree809TagsRevision: DECREE_809_TAGS_REVISION,
      popularValueTagsThreshold:
        PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.popularValueTagsThreshold,
    };
  }

  /**
   * Get platform settings. Creates document with defaults if missing.
   */
  async get(): Promise<PlatformSettings> {
    let doc = await this.platformSettingsPersistence.findById(PLATFORM_SETTINGS_ID);
    if (!doc) {
      doc = await this.platformSettingsPersistence.createWithBootstrap(
        this.getBootstrapInput(),
      );
    }
    const result = doc as PlatformSettings;
    if (!result.availableFutureVisionTags) {
      result.availableFutureVisionTags = [];
    }
    if (!result.decree809Tags || result.decree809Tags.length === 0) {
      await this.platformSettingsPersistence.updateById(PLATFORM_SETTINGS_ID, {
        decree809Tags: [...DECREE_809_TAGS],
        decree809TagsRevision: DECREE_809_TAGS_REVISION,
        updatedAt: new Date(),
      });
      result.decree809Tags = [...DECREE_809_TAGS];
      result.decree809TagsRevision = DECREE_809_TAGS_REVISION;
    }
    if (result.decree809Enabled == null) {
      result.decree809Enabled = false;
    }
    if (
      result.popularValueTagsThreshold == null ||
      result.popularValueTagsThreshold < 1
    ) {
      result.popularValueTagsThreshold = 5;
    }
    return result;
  }

  /**
   * Get welcome merits for new users in global (priority) communities.
   * Default: PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.welcomeMeritsGlobal.
   */
  async getWelcomeMeritsGlobal(): Promise<number> {
    const settings = await this.get();
    return settings.welcomeMeritsGlobal ?? 0;
  }

  /**
   * Update platform settings (superadmin only via router).
   */
  async update(dto: UpdatePlatformSettingsDto): Promise<PlatformSettings> {
    const update: Partial<PlatformSettings> = {};
    if (dto.welcomeMeritsGlobal !== undefined) {
      if (dto.welcomeMeritsGlobal < 0) {
        throw new Error('welcomeMeritsGlobal must be >= 0');
      }
      update.welcomeMeritsGlobal = dto.welcomeMeritsGlobal;
    }
    const doc = await this.platformSettingsPersistence.updateWithUpsert(
      PLATFORM_SETTINGS_ID,
      update,
      this.getBootstrapInput(),
    );
    if (!doc) {
      throw new Error('Failed to update platform settings');
    }
    return doc as PlatformSettings;
  }

  /**
   * Update available future vision tags (rubricator). Superadmin only.
   */
  async updateFutureVisionTags(tags: string[]): Promise<PlatformSettings> {
    const doc = await this.platformSettingsPersistence.updateWithUpsert(
      PLATFORM_SETTINGS_ID,
      { availableFutureVisionTags: tags, updatedAt: new Date() },
      this.getBootstrapInput(),
    );
    if (!doc) {
      throw new Error('Failed to update platform settings');
    }
    return doc as PlatformSettings;
  }

  async updateDecree809Enabled(enabled: boolean): Promise<PlatformSettings> {
    const doc = await this.platformSettingsPersistence.updateWithUpsert(
      PLATFORM_SETTINGS_ID,
      { decree809Enabled: enabled, updatedAt: new Date() },
      this.getBootstrapInput(),
    );
    if (!doc) {
      throw new Error('Failed to update platform settings');
    }
    return doc as PlatformSettings;
  }

  /**
   * Superadmin dev tool: clear admin-added rubricator extras and reset persisted decree 809
   * list to the canonical in-repo `DECREE_809_TAGS`. Does not change `decree809Enabled`.
   */
  async resetDecree809RubricatorToCanonical(): Promise<PlatformSettings> {
    this.logger.log(
      'Reset decree 809 tags to canonical list; clearing availableFutureVisionTags',
    );
    const doc = await this.platformSettingsPersistence.updateWithUpsert(
      PLATFORM_SETTINGS_ID,
      {
        availableFutureVisionTags: [],
        decree809Tags: [...DECREE_809_TAGS],
        decree809TagsRevision: DECREE_809_TAGS_REVISION,
        updatedAt: new Date(),
      },
      this.getBootstrapInput(),
    );
    if (!doc) {
      throw new Error('Failed to reset decree 809 rubricator');
    }
    return doc as PlatformSettings;
  }

  async getDemoSeedVersion(): Promise<number | undefined> {
    const doc = await this.platformSettingsPersistence.findById(
      PLATFORM_SETTINGS_ID,
    );
    return doc?.demoSeedVersion;
  }

  async setDemoSeedVersion(version: number): Promise<void> {
    await this.platformSettingsPersistence.updateWithUpsert(
      PLATFORM_SETTINGS_ID,
      { demoSeedVersion: version, updatedAt: new Date() },
      this.getBootstrapInput(),
    );
  }

  /** Cleared after platform wipe so demo seed can run again. */
  async clearDemoSeedVersion(): Promise<void> {
    await this.platformSettingsPersistence.unsetFields(PLATFORM_SETTINGS_ID, [
      'demoSeedVersion',
    ]);
  }

  async getEntrepreneursDemoPack(): Promise<
    PlatformSettings['entrepreneursDemoPack'] | undefined
  > {
    const doc = await this.platformSettingsPersistence.findById(PLATFORM_SETTINGS_ID);
    return doc?.entrepreneursDemoPack;
  }

  async setEntrepreneursDemoPack(
    pack: NonNullable<PlatformSettings['entrepreneursDemoPack']>,
  ): Promise<void> {
    await this.platformSettingsPersistence.updateWithUpsert(
      PLATFORM_SETTINGS_ID,
      { entrepreneursDemoPack: pack, updatedAt: new Date() },
      this.getBootstrapInput(),
    );
  }

  async getDemoPersonasEnabled(): Promise<boolean> {
    const doc = await this.get();
    return doc.demoPersonasEnabled === true;
  }

  async setDemoPersonasEnabled(enabled: boolean): Promise<PlatformSettings> {
    const doc = await this.platformSettingsPersistence.updateWithUpsert(
      PLATFORM_SETTINGS_ID,
      { demoPersonasEnabled: enabled, updatedAt: new Date() },
      this.getBootstrapInput(),
    );
    if (!doc) {
      throw new Error('Failed to update platform settings');
    }
    return doc as PlatformSettings;
  }

  /**
   * Full platform_settings row from dev snapshot JSON (fallback: PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP).
   */
  async resetAfterPlatformWipe(): Promise<void> {
    const snap = loadDevPlatformSnapshot();
    const ps = snap.platformSettings;
    await this.platformSettingsPersistence.resetAfterPlatformWipe(
      PLATFORM_SETTINGS_ID,
      {
        welcomeMeritsGlobal: ps.welcomeMeritsGlobal,
        availableFutureVisionTags: [...(ps.availableFutureVisionTags ?? [])],
        decree809Enabled: ps.decree809Enabled ?? false,
        decree809Tags: [...(ps.decree809Tags ?? DECREE_809_TAGS)],
        decree809TagsRevision: DECREE_809_TAGS_REVISION,
        popularValueTagsThreshold: ps.popularValueTagsThreshold ?? 5,
        updatedAt: new Date(),
      },
    );
    await this.platformSettingsPersistence.unsetFields(PLATFORM_SETTINGS_ID, [
      'demoSeedVersion',
    ]);
  }
}
