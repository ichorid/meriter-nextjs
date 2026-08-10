import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserSettingsSchemaClass,
  UserSettingsDocument,
} from '../../domain/models/user-settings.schema';
import {
  USER_SETTINGS_PERSISTENCE_PORT,
  type UserSettingsPersistencePort,
  type UserSettingsRecord,
} from '../../domain/ports/user-settings.persistence.port';

@Injectable()
export class UserSettingsPersistenceAdapter implements UserSettingsPersistencePort {
  constructor(
    @InjectModel(UserSettingsSchemaClass.name)
    private readonly model: Model<UserSettingsDocument>,
  ) {}

  async findByUserId(userId: string): Promise<UserSettingsRecord | null> {
    const doc = await this.model.findOne({ userId }).lean<UserSettingsRecord>().exec();
    return doc ?? null;
  }

  async createDefault(
    userId: string,
    updatesFrequency: UserSettingsRecord['updatesFrequency'],
  ): Promise<UserSettingsRecord> {
    const created = await this.model.create({ userId, updatesFrequency });
    return created.toObject() as UserSettingsRecord;
  }

  async upsertUpdatesFrequency(
    userId: string,
    frequency: UserSettingsRecord['updatesFrequency'],
  ): Promise<UserSettingsRecord> {
    const updated = await this.model
      .findOneAndUpdate(
        { userId },
        { updatesFrequency: frequency },
        { upsert: true, new: true },
      )
      .lean<UserSettingsRecord>()
      .exec();
    return updated as UserSettingsRecord;
  }

  async markHourlyDelivered(userId: string, at: Date): Promise<void> {
    await this.model
      .updateOne({ userId }, { $set: { lastHourlyDeliveredAt: at } }, { upsert: true })
      .exec();
  }

  async markDailyDelivered(userId: string, at: Date): Promise<void> {
    await this.model
      .updateOne({ userId }, { $set: { lastDailyDeliveredAt: at } }, { upsert: true })
      .exec();
  }

  async upsertNotificationsReadUpToId(
    userId: string,
    notificationId: string,
  ): Promise<UserSettingsRecord> {
    const updated = await this.model
      .findOneAndUpdate(
        { userId },
        { notificationsReadUpToId: notificationId },
        { upsert: true, new: true },
      )
      .lean<UserSettingsRecord>()
      .exec();
    return updated as UserSettingsRecord;
  }
}

export const userSettingsPersistenceProvider = {
  provide: USER_SETTINGS_PERSISTENCE_PORT,
  useClass: UserSettingsPersistenceAdapter,
};
