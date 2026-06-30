import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuthMagicLinkDocument = AuthMagicLink & Document;

/**
 * One-time magic link token for SMS/Email login.
 * User can click the link to log in without entering OTP (same or different device).
 */
@Schema({ timestamps: true })
export class AuthMagicLink {
  @Prop({ required: true, unique: true, index: true })
  token!: string;

  @Prop({ required: true })
  channel!: 'sms' | 'email';

  @Prop({ required: true, index: true })
  target!: string; // E.164 phone or email

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop()
  usedAt?: Date;
}

export const AuthMagicLinkSchema = SchemaFactory.createForClass(AuthMagicLink);

AuthMagicLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
