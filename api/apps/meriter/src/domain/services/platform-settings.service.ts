import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PlatformSettingsSchemaClass,
  PlatformSettingsDocument,
  PlatformSettings,
  PLATFORM_SETTINGS_ID,
} from '../models/platform-settings/platform-settings.schema';
import { PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP } from '../common/constants/platform-bootstrap.constants';
import { DECREE_809_TAGS } from '@meriter/shared-types';
import { loadDevPlatformSnapshot } from '../../seed-data/load-dev-platform-snapshot';

export interface UpdatePlatformSettingsDto {
  welcomeMeritsGlobal?: number;
}

@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);

  constructor(
    @InjectModel(PlatformSettingsSchemaClass.name)
    private platformSettingsModel: Model<PlatformSettingsDocument>,
  ) {}

  /**
   * Get platform settings. Creates document with defaults if missing.
   */
  async get(): Promise<PlatformSettings> {
    let doc: PlatformSettings | null = (await this.platformSettingsModel
      .findOne({ id: PLATFORM_SETTINGS_ID })
      .lean()
      .exec()) as PlatformSettings | null;
    if (!doc) {
      const created = await this.platformSettingsModel.create({
        id: PLATFORM_SETTINGS_ID,
        welcomeMeritsGlobal: PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.welcomeMeritsGlobal,
        availableFutureVisionTags: [
          ...PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.availableFutureVisionTags,
        ],
        decree809Enabled: PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.decree809Enabled,
        decree809Tags: [...PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.decree809Tags],
        popularValueTagsThreshold:
          PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.popularValueTagsThreshold,
      });
      doc = created.toObject() as unknown as PlatformSettings;
    }
    const result = doc;
    if (!result.availableFutureVisionTags) {
      result.availableFutureVisionTags = [];
    }
    if (!result.decree809Tags || result.decree809Tags.length === 0) {
      await this.platformSettingsModel
        .updateOne(
          { id: PLATFORM_SETTINGS_ID },
          {
            $set: {
              decree809Tags: [...DECREE_809_TAGS],
              updatedAt: new Date(),
            },
          },
        )
        .exec();
      result.decree809Tags = [...DECREE_809_TAGS];
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
    const doc = await this.platformSettingsModel
      .findOneAndUpdate(
        { id: PLATFORM_SETTINGS_ID },
        { $set: update },
        { new: true, upsert: true, runValidators: true },
      )
      .lean()
      .exec();
    if (!doc) {
      throw new Error('Failed to update platform settings');
    }
    return doc as PlatformSettings;
  }

  /**
   * Update available future vision tags (rubricator). Superadmin only.
   */
  async updateFutureVisionTags(tags: string[]): Promise<PlatformSettings> {
    const doc = await this.platformSettingsModel
      .findOneAndUpdate(
        { id: PLATFORM_SETTINGS_ID },
        { $set: { availableFutureVisionTags: tags, updatedAt: new Date() } },
        { new: true, upsert: true, runValidators: true },
      )
      .lean()
      .exec();
    if (!doc) {
      throw new Error('Failed to update platform settings');
    }
    return doc as PlatformSettings;
  }

  async updateDecree809Enabled(enabled: boolean): Promise<PlatformSettings> {
    const doc = await this.platformSettingsModel
      .findOneAndUpdate(
        { id: PLATFORM_SETTINGS_ID },
        { $set: { decree809Enabled: enabled, updatedAt: new Date() } },
        { new: true, upsert: true, runValidators: true },
      )
      .lean()
      .exec();
    if (!doc) {
      throw new Error('Failed to update platform settings');
    }
    return doc as PlatformSettings;
  }

  async getDemoSeedVersion(): Promise<number | undefined> {
    const doc = await this.platformSettingsModel
      .findOne({ id: PLATFORM_SETTINGS_ID })
      .lean()
      .exec();
    return doc?.demoSeedVersion;
  }

  async setDemoSeedVersion(version: number): Promise<void> {
    const res = await this.platformSettingsModel
      .updateOne(
        { id: PLATFORM_SETTINGS_ID },
        { $set: { demoSeedVersion: version, updatedAt: new Date() } },
      )
      .exec();
    if (res.matchedCount === 0) {
      await this.platformSettingsModel.create({
        id: PLATFORM_SETTINGS_ID,
        welcomeMeritsGlobal: PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.welcomeMeritsGlobal,
        availableFutureVisionTags: [
          ...PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.availableFutureVisionTags,
        ],
        decree809Enabled: PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.decree809Enabled,
        decree809Tags: [...PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.decree809Tags],
        popularValueTagsThreshold:
          PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.popularValueTagsThreshold,
        demoSeedVersion: version,
      });
    }
  }

  /** Cleared after platform wipe so demo seed can run again. */
  async clearDemoSeedVersion(): Promise<void> {
    await this.platformSettingsModel
      .updateOne({ id: PLATFORM_SETTINGS_ID }, { $unset: { demoSeedVersion: 1 } })
      .exec();
  }

  /**
   * Full platform_settings row from dev snapshot JSON (fallback: PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP).
   */
  async resetAfterPlatformWipe(): Promise<void> {
    const snap = loadDevPlatformSnapshot();
    const ps = snap.platformSettings;
    await this.platformSettingsModel
      .updateOne(
        { id: PLATFORM_SETTINGS_ID },
        {
          $set: {
            welcomeMeritsGlobal: ps.welcomeMeritsGlobal,
            availableFutureVisionTags: [...(ps.availableFutureVisionTags ?? [])],
            decree809Enabled: ps.decree809Enabled ?? false,
            decree809Tags: [...(ps.decree809Tags ?? DECREE_809_TAGS)],
            popularValueTagsThreshold: ps.popularValueTagsThreshold ?? 5,
            updatedAt: new Date(),
          },
          $unset: { demoSeedVersion: '' },
        },
        { upsert: true },
      )
      .exec();
  }
}
