import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SmsOtp, SmsOtpDocument } from '../../domain/models/auth/sms-otp.schema';
import { AppConfig } from '../../config/configuration';
import axios from 'axios';

/**
 * Abstract SMS Provider Interface
 */
interface SmsProvider {
    sendSms(phoneNumber: string, message: string): Promise<void>;
}

/**
 * SMS.ru Provider Implementation
 * API Documentation: https://sms.ru/api/send
 */
class SmsRuProvider implements SmsProvider {
    private readonly logger = new Logger(SmsRuProvider.name);
    private readonly apiUrl: string;
    private readonly apiId: string;
    private readonly from: string;
    private readonly testMode: boolean;

    constructor(config: ConfigService<AppConfig>) {
        this.apiUrl = config.get('sms')?.apiUrl || 'https://sms.ru';
        this.apiId = config.get('sms')?.apiId || '';
        this.from = config.get('sms')?.from || 'Meriter';
        this.testMode = config.get('sms')?.testMode ?? true;

        if (!this.apiId && !this.testMode) {
            throw new Error('SMS.ru API ID is required when not in test mode');
        }
    }

    async sendSms(phoneNumber: string, message: string): Promise<void> {
        const url = `${this.apiUrl}/sms/send`;

        const params = {
            api_id: this.apiId,
            to: phoneNumber.replace('+', ''), // SMS.ru expects phone without +
            msg: message,
            from: this.from,
            json: '1', // JSON response
            test: this.testMode ? '1' : '0',
        };

        try {
            const response = await axios.get(url, { params });

            if (response.data.status !== 'OK') {
                this.logger.error(`SMS.ru error: ${JSON.stringify(response.data)}`);
                throw new Error(`Failed to send SMS: ${response.data.status_text || 'Unknown error'}`);
            }

            this.logger.log(`SMS sent successfully to ${phoneNumber} (test mode: ${this.testMode})`);
        } catch (error) {
            this.logger.error(`Failed to send SMS via SMS.ru: ${error}`);
            throw error;
        }
    }
}

/**
 * Twilio Provider Implementation (placeholder for future)
 */
class TwilioProvider implements SmsProvider {
    private readonly logger = new Logger(TwilioProvider.name);

    constructor(_config: ConfigService<AppConfig>) {
        // TODO: Initialize Twilio client when needed
        this.logger.warn('Twilio provider not yet implemented');
    }

    async sendSms(_phoneNumber: string, _message: string): Promise<void> {
        throw new Error('Twilio provider not yet implemented');
    }
}

/**
 * SMS Provider Service
 * Handles OTP generation, sending, and verification with rate limiting
 */
@Injectable()
export class SmsProviderService {
    private readonly logger = new Logger(SmsProviderService.name);
    private readonly provider: SmsProvider;
    private readonly otpLength: number;
    private readonly otpExpiryMinutes: number;
    private readonly maxAttemptsPerOtp: number;
    private readonly rateLimitPerHour: number;
    private readonly resendCooldownSeconds: number;

    constructor(
        private readonly configService: ConfigService<AppConfig>,
        @InjectModel(SmsOtp.name)
        private readonly smsOtpModel: Model<SmsOtpDocument>,
    ) {
        const smsConfig = this.configService.get('sms');
        const providerName = smsConfig?.provider || 'smsru';

        // Initialize provider based on config
        switch (providerName) {
            case 'smsru':
                this.provider = new SmsRuProvider(this.configService);
                break;
            case 'twilio':
                this.provider = new TwilioProvider(this.configService);
                break;
            default:
                throw new Error(`Unknown SMS provider: ${providerName}`);
        }

        this.otpLength = smsConfig?.otpLength ?? 6;
        this.otpExpiryMinutes = smsConfig?.otpExpiryMinutes ?? 5;
        this.maxAttemptsPerOtp = smsConfig?.maxAttemptsPerOtp ?? 3;
        this.rateLimitPerHour = smsConfig?.rateLimitPerHour ?? 3;
        this.resendCooldownSeconds = smsConfig?.resendCooldownSeconds ?? 60;

        this.logger.log(`SMS Provider initialized: ${providerName}`);
    }

    /**
     * Generate a random OTP code
     */
    private generateOtp(): string {
        const min = Math.pow(10, this.otpLength - 1);
        const max = Math.pow(10, this.otpLength) - 1;
        return Math.floor(Math.random() * (max - min + 1) + min).toString();
    }

    /**
     * Check rate limiting: max N SMS per hour per phone
     */
    private async checkRateLimit(phoneNumber: string): Promise<void> {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const recentCount = await this.smsOtpModel.countDocuments({
            phoneNumber,
            lastSentAt: { $gte: oneHourAgo },
        });

        if (recentCount >= this.rateLimitPerHour) {
            throw new Error('Rate limit exceeded. Please try again later.');
        }
    }

    /**
     * Check resend cooldown: min 60 seconds between sends
     */
    private async checkResendCooldown(phoneNumber: string): Promise<Date | null> {
        const cooldownAgo = new Date(Date.now() - this.resendCooldownSeconds * 1000);

        const recentOtp = await this.smsOtpModel
            .findOne({ phoneNumber, lastSentAt: { $gte: cooldownAgo } })
            .sort({ lastSentAt: -1 });

        if (recentOtp) {
            const canResendAt = new Date(recentOtp.lastSentAt.getTime() + this.resendCooldownSeconds * 1000);
            return canResendAt;
        }

        return null;
    }

    /**
     * Send OTP to phone number
     * Returns expiration time and next resend time
     */
    async sendOtp(phoneNumber: string): Promise<{
        expiresIn: number;
        canResendAt: Date;
    }> {
        // Check rate limiting
        await this.checkRateLimit(phoneNumber);

        // Check resend cooldown
        const canResendAt = await this.checkResendCooldown(phoneNumber);
        if (canResendAt && canResendAt > new Date()) {
            throw new Error(`Please wait before requesting another code. Can resend at: ${canResendAt.toISOString()}`);
        }

        // Generate OTP
        const otpCode = this.generateOtp();
        const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000);
        const now = new Date();

        // Save OTP to database
        await this.smsOtpModel.create({
            phoneNumber,
            otpCode,
            expiresAt,
            lastSentAt: now,
            verified: false,
            attempts: 0,
        });

        // Send SMS
        const message = `Your Meriter verification code: ${otpCode}. Valid for ${this.otpExpiryMinutes} minutes.`;
        await this.provider.sendSms(phoneNumber, message);

        this.logger.log(`OTP sent to ${phoneNumber}, expires at ${expiresAt.toISOString()}`);

        return {
            expiresIn: this.otpExpiryMinutes * 60,
            canResendAt: new Date(now.getTime() + this.resendCooldownSeconds * 1000),
        };
    }

    /**
     * Verify OTP code
     * Returns true if valid, throws error if invalid/expired
     */
    async verifyOtp(phoneNumber: string, otpCode: string): Promise<boolean> {
        // Find the most recent non-verified OTP for this phone
        const otp = await this.smsOtpModel
            .findOne({
                phoneNumber,
                verified: false,
                expiresAt: { $gt: new Date() },
            })
            .sort({ lastSentAt: -1 });

        if (!otp) {
            throw new Error('No valid OTP found. Please request a new code.');
        }

        // Check if max attempts exceeded
        if (otp.attempts >= this.maxAttemptsPerOtp) {
            throw new Error('Maximum verification attempts exceeded. Please request a new code.');
        }

        // Verify code
        if (otp.otpCode !== otpCode) {
            // Increment attempts
            otp.attempts += 1;
            await otp.save();

            const remainingAttempts = this.maxAttemptsPerOtp - otp.attempts;
            throw new Error(`Invalid code. ${remainingAttempts} attempts remaining.`);
        }

        // Mark as verified
        otp.verified = true;
        await otp.save();

        this.logger.log(`OTP verified successfully for ${phoneNumber}`);
        return true;
    }
}
