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
    let doc = await this.platformSettingsModel
      .findOne({ id: PLATFORM_SETTINGS_ID })
      .lean()
      .exec();
    if (!doc) {
      const created = await this.platformSettingsModel.create({
        id: PLATFORM_SETTINGS_ID,
        welcomeMeritsGlobal: 0,
        availableFutureVisionTags: [],
      });
      doc = created.toObject() as typeof doc;
    }
    const result = doc as PlatformSettings;
    if (!result.availableFutureVisionTags) {
      result.availableFutureVisionTags = [];
    }
    return result;
  }

  /**
   * Get welcome merits for new users in global (priority) communities. Default 0.
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
   * Full platform_settings row to code bootstrap (welcome merits, empty FV rubric, no demo marker).
   */
  async resetAfterPlatformWipe(): Promise<void> {
    await this.platformSettingsModel
      .updateOne(
        { id: PLATFORM_SETTINGS_ID },
        {
          $set: {
            welcomeMeritsGlobal: PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.welcomeMeritsGlobal,
            availableFutureVisionTags: [
              ...PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.availableFutureVisionTags,
            ],
            updatedAt: new Date(),
          },
          $unset: { demoSeedVersion: '' },
        },
        { upsert: true },
      )
      .exec();
  }
}
