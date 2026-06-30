export const USER_SETTINGS_PERSISTENCE_PORT = Symbol('USER_SETTINGS_PERSISTENCE_PORT');

export interface UserSettingsRecord {
  userId: string;
  updatesFrequency: 'immediate' | 'hourly' | 'daily' | 'never';
  lastHourlyDeliveredAt?: Date;
  lastDailyDeliveredAt?: Date;
  notificationsReadUpToId?: string;
}

/**
 * UserSettingsPersistencePort — per-user notification/delivery preferences (V-12).
 */
export interface UserSettingsPersistencePort {
  findByUserId(userId: string): Promise<UserSettingsRecord | null>;

  createDefault(userId: string, updatesFrequency: UserSettingsRecord['updatesFrequency']): Promise<UserSettingsRecord>;

  upsertUpdatesFrequency(
    userId: string,
    frequency: UserSettingsRecord['updatesFrequency'],
  ): Promise<UserSettingsRecord>;

  markHourlyDelivered(userId: string, at: Date): Promise<void>;

  markDailyDelivered(userId: string, at: Date): Promise<void>;

  upsertNotificationsReadUpToId(userId: string, notificationId: string): Promise<UserSettingsRecord>;
}
