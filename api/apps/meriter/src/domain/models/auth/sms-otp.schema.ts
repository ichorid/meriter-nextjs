import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SmsOtpDocument = SmsOtp & Document;

/**
 * SMS OTP Schema
 * Stores one-time passwords for SMS authentication
 */
@Schema({ timestamps: true })
export class SmsOtp {
    @Prop({ required: true, index: true })
    phoneNumber!: string; // E.164 format, e.g., "+79537629661"

    @Prop({ required: true })
    otpCode!: string; // 6-digit code

    @Prop({ required: true })
    expiresAt!: Date; // TTL: 5 minutes from creation

    @Prop({ default: false })
    verified!: boolean; // true when successfully verified

    @Prop({ default: 0 })
    attempts!: number; // failed verification attempts (max 3)

    @Prop({ required: true })
    lastSentAt!: Date; // for rate limiting resends (60 seconds cooldown)
}

export const SmsOtpSchema = SchemaFactory.createForClass(SmsOtp);

// TTL index: auto-delete expired OTPs
SmsOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for rate limiting: find recent OTPs by phone
SmsOtpSchema.index({ phoneNumber: 1, lastSentAt: -1 });
