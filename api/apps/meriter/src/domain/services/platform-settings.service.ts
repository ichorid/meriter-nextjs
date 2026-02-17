import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PlatformSettingsSchemaClass,
  PlatformSettingsDocument,
  PlatformSettings,
  PLATFORM_SETTINGS_ID,
} from '../models/platform-settings/platform-settings.schema';

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
      doc = await this.platformSettingsModel
        .create({
          id: PLATFORM_SETTINGS_ID,
          welcomeMeritsGlobal: 0,
        })
        .then((d) => d.toObject());
    }
    return doc as PlatformSettings;
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
}
