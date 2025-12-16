import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface UserSettings {
  userId: string;
  updatesFrequency: 'immediate' | 'hourly' | 'daily' | 'never';
  lastHourlyDeliveredAt?: Date;
  lastDailyDeliveredAt?: Date;
  notificationsReadUpToId?: string;
}

@Schema({ collection: 'user_settings', timestamps: true })
export class UserSettingsSchemaClass implements UserSettings {
  @Prop({ required: true, unique: true })
  userId: string;

  // immediate | hourly | daily | never
  @Prop({ required: true, default: 'daily' })
  updatesFrequency: 'immediate' | 'hourly' | 'daily' | 'never';

  // Track last delivered periods for batching
  @Prop()
  lastHourlyDeliveredAt?: Date;

  @Prop()
  lastDailyDeliveredAt?: Date;

  // Notification read status - ID of the last read notification
  @Prop()
  notificationsReadUpToId?: string;
}

export const UserSettingsSchema = SchemaFactory.createForClass(UserSettingsSchemaClass);
export type UserSettingsDocument = UserSettingsSchemaClass & Document;
