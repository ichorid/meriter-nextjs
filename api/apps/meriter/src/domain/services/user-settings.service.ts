import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserSettingsSchemaClass, UserSettingsDocument } from '../models/user-settings.schema';
import type { UserSettings } from '../models/user-settings.schema';

@Injectable()
export class UserSettingsService {
  private readonly logger = new Logger(UserSettingsService.name);

  constructor(
    @InjectModel(UserSettingsSchemaClass.name) private readonly model: Model<UserSettingsDocument>,
  ) {}

  async getOrCreate(userId: string): Promise<UserSettings> {
    let settings = await this.model.findOne({ userId }).lean<UserSettings>().exec();
    if (!settings) {
      const created = await this.model.create({ userId, updatesFrequency: 'daily' });
      settings = created.toObject();
    }
    return settings;
  }

  async setUpdatesFrequency(userId: string, frequency: 'immediate' | 'hourly' | 'daily' | 'never'): Promise<UserSettings> {
    const updated = await this.model.findOneAndUpdate(
      { userId },
      { updatesFrequency: frequency },
      { upsert: true, new: true },
    ).lean<UserSettings>().exec();
    return updated as UserSettings;
  }

  async markHourlyDelivered(userId: string, at: Date): Promise<void> {
    await this.model.updateOne({ userId }, { $set: { lastHourlyDeliveredAt: at } }, { upsert: true }).exec();
  }

  async markDailyDelivered(userId: string, at: Date): Promise<void> {
    await this.model.updateOne({ userId }, { $set: { lastDailyDeliveredAt: at } }, { upsert: true }).exec();
  }

  async updateNotificationsReadUpToId(userId: string, notificationId: string): Promise<UserSettings> {
    const updated = await this.model.findOneAndUpdate(
      { userId },
      { notificationsReadUpToId: notificationId },
      { upsert: true, new: true },
    ).lean<UserSettings>().exec();
    return updated as UserSettings;
  }
}


