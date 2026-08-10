import { Injectable, Logger, Inject } from '@nestjs/common';
import type { UserSettings } from '../models/user-settings.schema';
import {
  USER_SETTINGS_PERSISTENCE_PORT,
  type UserSettingsPersistencePort,
} from '../ports/user-settings.persistence.port';

@Injectable()
export class UserSettingsService {
  private readonly logger = new Logger(UserSettingsService.name);

  constructor(
    @Inject(USER_SETTINGS_PERSISTENCE_PORT)
    private readonly userSettingsPersistence: UserSettingsPersistencePort,
  ) {}

  async getOrCreate(userId: string): Promise<UserSettings> {
    let settings = await this.userSettingsPersistence.findByUserId(userId);
    if (!settings) {
      settings = await this.userSettingsPersistence.createDefault(userId, 'daily');
    }
    return settings as UserSettings;
  }

  async setUpdatesFrequency(userId: string, frequency: 'immediate' | 'hourly' | 'daily' | 'never'): Promise<UserSettings> {
    const updated = await this.userSettingsPersistence.upsertUpdatesFrequency(
      userId,
      frequency,
    );
    return updated as UserSettings;
  }

  async markHourlyDelivered(userId: string, at: Date): Promise<void> {
    await this.userSettingsPersistence.markHourlyDelivered(userId, at);
  }

  async markDailyDelivered(userId: string, at: Date): Promise<void> {
    await this.userSettingsPersistence.markDailyDelivered(userId, at);
  }

  async updateNotificationsReadUpToId(userId: string, notificationId: string): Promise<UserSettings> {
    const updated = await this.userSettingsPersistence.upsertNotificationsReadUpToId(
      userId,
      notificationId,
    );
    return updated as UserSettings;
  }
}


