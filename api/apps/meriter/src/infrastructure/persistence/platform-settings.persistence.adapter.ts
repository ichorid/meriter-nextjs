import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PlatformSettingsSchemaClass,
  PlatformSettingsDocument,
} from '../../domain/models/platform-settings/platform-settings.schema';
import {
  PLATFORM_SETTINGS_PERSISTENCE_PORT,
  type PlatformSettingsBootstrapInput,
  type PlatformSettingsPersistencePort,
  type PlatformSettingsRecord,
  type PlatformSettingsUpdateSet,
} from '../../domain/ports/platform-settings.persistence.port';

@Injectable()
export class PlatformSettingsPersistenceAdapter implements PlatformSettingsPersistencePort {
  constructor(
    @InjectModel(PlatformSettingsSchemaClass.name)
    private readonly platformSettingsModel: Model<PlatformSettingsDocument>,
  ) {}

  async findById(id: string): Promise<PlatformSettingsRecord | null> {
    const doc = await this.platformSettingsModel.findOne({ id }).lean().exec();
    return doc ? (doc as PlatformSettingsRecord) : null;
  }

  async createWithBootstrap(input: PlatformSettingsBootstrapInput): Promise<PlatformSettingsRecord> {
    const created = await this.platformSettingsModel.create({
      id: 'platform',
      ...input,
    });
    return created.toObject() as unknown as PlatformSettingsRecord;
  }

  async updateById(
    id: string,
    set: PlatformSettingsUpdateSet,
  ): Promise<PlatformSettingsRecord | null> {
    const doc = await this.platformSettingsModel
      .findOneAndUpdate({ id }, { $set: set }, { new: true, upsert: true, runValidators: true })
      .lean()
      .exec();
    return doc ? (doc as PlatformSettingsRecord) : null;
  }

  async updateWithUpsert(
    id: string,
    set: PlatformSettingsUpdateSet,
    setOnInsert?: PlatformSettingsBootstrapInput,
  ): Promise<PlatformSettingsRecord | null> {
    const doc = await this.platformSettingsModel
      .findOneAndUpdate(
        { id },
        {
          $set: set,
          ...(setOnInsert ? { $setOnInsert: { id, ...setOnInsert } } : {}),
        },
        { new: true, upsert: true, runValidators: true },
      )
      .lean()
      .exec();
    return doc ? (doc as PlatformSettingsRecord) : null;
  }

  async unsetFields(id: string, fields: string[]): Promise<void> {
    const unset = Object.fromEntries(fields.map((f) => [f, 1]));
    await this.platformSettingsModel.updateOne({ id }, { $unset: unset }).exec();
  }

  async resetAfterPlatformWipe(id: string, set: PlatformSettingsUpdateSet): Promise<void> {
    await this.platformSettingsModel
      .updateOne(
        { id },
        {
          $set: set,
          $unset: { demoSeedVersion: '' },
        },
        { upsert: true },
      )
      .exec();
  }
}

export const platformSettingsPersistenceProvider = {
  provide: PLATFORM_SETTINGS_PERSISTENCE_PORT,
  useClass: PlatformSettingsPersistenceAdapter,
};
