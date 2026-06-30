import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EmailOtpDocument = EmailOtp & Document;

/**
 * Email OTP Schema
 * Stores one-time passwords for Email authentication
 */
@Schema({ timestamps: true })
export class EmailOtp {
    @Prop({ required: true, index: true })
    email!: string;

    @Prop({ required: true })
    otpCode!: string; // 6-digit code

    @Prop({ required: true })
    expiresAt!: Date; // TTL: 15 minutes from creation

    @Prop({ default: false })
    verified!: boolean; // true when successfully verified

    @Prop({ default: 0 })
    attempts!: number; // failed verification attempts (max 3)

    @Prop({ required: true })
    lastSentAt!: Date; // for rate limiting resends (60 seconds cooldown)
}

export const EmailOtpSchema = SchemaFactory.createForClass(EmailOtp);

// TTL index: auto-delete expired OTPs
EmailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for rate limiting: find recent OTPs by email
EmailOtpSchema.index({ email: 1, lastSentAt: -1 });
