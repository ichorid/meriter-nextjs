import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserSettingsDocument = UserSettings & Document;

@Schema({ collection: 'user_settings', timestamps: true })
export class UserSettings {
  @Prop({ required: true, unique: true })
  userId: string;

  // immediate | hourly | daily | never
  @Prop({ required: true, default: 'daily' })
  updatesFrequency: string;

  // Track last delivered periods for batching
  @Prop()
  lastHourlyDeliveredAt?: Date;

  @Prop()
  lastDailyDeliveredAt?: Date;
}

export const UserSettingsSchema = SchemaFactory.createForClass(UserSettings);


