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
interface SmsProviderOptions {
    ip?: string;
}

interface SmsProvider {
    sendSms(phoneNumber: string, message: string, options?: SmsProviderOptions): Promise<void>;
    initCallCheck?(phoneNumber: string): Promise<{ checkId: string; callPhone: string; callPhonePretty: string }>;
    checkCallStatus?(checkId: string): Promise<{ status: 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'ERROR'; serverStatus: number }>;
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
        const smsConfig = config.get('sms');
        if (!smsConfig) {
            throw new Error('SMS configuration is missing');
        }

        if (!smsConfig.apiUrl) {
            throw new Error('SMS API URL is not configured');
        }

        this.apiUrl = smsConfig.apiUrl;
        this.apiId = smsConfig.apiId || '';
        this.from = smsConfig.from || '';
        this.testMode = smsConfig.testMode ?? true;

        if (!this.apiId && !this.testMode) {
            throw new Error('SMS.ru API ID is required when not in test mode');
        }
    }

    async sendSms(phoneNumber: string, message: string, options?: SmsProviderOptions): Promise<void> {
        // apiUrl is expected to include /sms base (e.g. https://sms.ru/sms)
        const url = `${this.apiUrl}/send`;

        const params: Record<string, string> = {
            api_id: this.apiId,
            to: phoneNumber.replace('+', ''), // SMS.ru expects phone without +
            msg: message,
            json: '1', // JSON response
            test: this.testMode ? '1' : '0',
        };

        if (this.from) {
            params.from = this.from;
        }

        if (options?.ip) {
            params.ip = options.ip;
        }

        try {
            const response = await axios.get(url, { params });

            if (response.data.status !== 'OK') {
                this.logger.error(`SMS.ru error: ${JSON.stringify(response.data)}`);
                throw new Error(`Failed to send SMS: ${response.data.status_text || 'Unknown error'}`);
            }

            // Check specific status for the phone number
            // The key in response.data.sms matches the 'to' parameter (without +)
            const phoneKey = params.to;
            const smsStatus = response.data.sms?.[phoneKey];

            if (smsStatus && smsStatus.status !== 'OK') {
                this.logger.error(`SMS.ru delivery failed for ${phoneNumber}: ${JSON.stringify(smsStatus)}`);
                throw new Error(smsStatus.status_text || 'SMS delivery failed');
            }

            this.logger.log(`SMS sent successfully to ${phoneNumber} (test mode: ${this.testMode})`);
        } catch (error) {
            this.logger.error(`Failed to send SMS via SMS.ru: ${error}`);
            throw error;
        }
    }

    async initCallCheck(phoneNumber: string): Promise<{ checkId: string; callPhone: string; callPhonePretty: string }> {
        // Construct URL based on apiUrl (e.g. from https://sms.ru/sms to https://sms.ru/callcheck/add)
        const baseUrl = this.apiUrl.replace(/\/sms\/?$/, '');
        const url = `${baseUrl}/callcheck/add`;

        const params: Record<string, string> = {
            api_id: this.apiId,
            phone: phoneNumber.replace('+', ''),
            json: '1',
        };

        try {
            const response = await axios.get(url, { params });

            if (response.data.status !== 'OK') {
                this.logger.error(`SMS.ru Call Check init error: ${JSON.stringify(response.data)}`);
                throw new Error(`Failed to initiate call check: ${response.data.status_text || 'Unknown error'}`);
            }

            return {
                checkId: response.data.check_id,
                callPhone: response.data.call_phone,
                callPhonePretty: response.data.call_phone_pretty,
            };
        } catch (error) {
            this.logger.error(`Failed to initiate call check via SMS.ru: ${error}`);
            throw error;
        }
    }

    async checkCallStatus(checkId: string): Promise<{ status: 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'ERROR'; serverStatus: number }> {
        // Construct URL based on apiUrl
        const baseUrl = this.apiUrl.replace(/\/sms\/?$/, '');
        const url = `${baseUrl}/callcheck/status`;

        const params: Record<string, string> = {
            api_id: this.apiId,
            check_id: checkId,
            json: '1',
        };

        try {
            const response = await axios.get(url, { params });

            if (response.data.status !== 'OK') {
                // API request itself failed, not the check status
                this.logger.error(`SMS.ru Call Check status error: ${JSON.stringify(response.data)}`);
                return { status: 'ERROR', serverStatus: 0 };
            }

            const checkStatus = parseInt(response.data.check_status, 10);

            // Map status codes from docbyphone.md:
            // 400: Pending
            // 401: Confirmed
            // 402: Expired/Error

            if (checkStatus === 401) {
                return { status: 'CONFIRMED', serverStatus: checkStatus };
            } else if (checkStatus === 400) {
                return { status: 'PENDING', serverStatus: checkStatus };
            } else if (checkStatus === 402) {
                return { status: 'EXPIRED', serverStatus: checkStatus };
            } else {
                return { status: 'ERROR', serverStatus: checkStatus };
            }

        } catch (error) {
            this.logger.error(`Failed to check call status via SMS.ru: ${error}`);
            throw error;
        }
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
        if (providerName === 'smsru') {
            this.provider = new SmsRuProvider(this.configService);
        } else {
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
    async sendOtp(phoneNumber: string, options?: SmsProviderOptions): Promise<{
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
        await this.provider.sendSms(phoneNumber, message, options);

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
    /**
     * Initiate Call Check verification
     * Returns the phone number the user needs to call and the check ID
     */
    async initiateCallVerification(phoneNumber: string): Promise<{
        checkId: string;
        callPhone: string;
        callPhonePretty: string;
        expiresIn: number;
    }> {
        if (!this.provider.initCallCheck) {
            throw new Error('Call verification is not supported by the current SMS provider');
        }

        // Check rate limiting (reuse existing logic)
        await this.checkRateLimit(phoneNumber);

        // Initiate call check
        const result = await this.provider.initCallCheck(phoneNumber);

        // We can optionally store this in DB if we want to track it via our own IDs or enforce rate limits strictly on our side vs params.
        // For now, mirroring `sendOtp`, let's just log and return. 
        // Note: The `docbyphone.md` says the check is valid for 5 minutes.

        return {
            ...result,
            expiresIn: 300, // 5 minutes standard for this service
        };
    }

    /**
     * Check status of Call Check verification
     */
    async verifyCallStatus(checkId: string): Promise<{ status: 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'ERROR' }> {
        if (!this.provider.checkCallStatus) {
            throw new Error('Call verification is not supported by the current SMS provider');
        }

        const result = await this.provider.checkCallStatus(checkId);
        return result;
    }
}
