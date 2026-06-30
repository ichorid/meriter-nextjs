import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppConfig } from '../../config/configuration';
import { EmailOtp, EmailOtpDocument } from '../../domain/models/auth/email-otp.schema';
import { AuthMagicLinkService } from './auth-magic-link.service';

@Injectable()
export class EmailProviderService {
    private readonly logger = new Logger(EmailProviderService.name);
    private readonly maxAttemptsPerOtp = 3;
    private readonly otpTtlMinutes = 15;
    private readonly resendCooldownSeconds = 60;

    constructor(
        private readonly configService: ConfigService<AppConfig>,
        @InjectModel(EmailOtp.name) private emailOtpModel: Model<EmailOtpDocument>,
        private readonly authMagicLinkService: AuthMagicLinkService,
    ) {}

    private initTransporter() {
        // This method is no longer used for SMTP but kept for structure if we need init logic
    }

    /**
     * Send OTP to email
     */
    async sendOtp(email: string): Promise<{ expiresIn: number; canResendAt: number }> {
        // Rate limiting check
        await this.checkRateLimit(email);

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.otpTtlMinutes * 60 * 1000);

        // Save OTP to DB
        await this.emailOtpModel.create({
            email,
            otpCode,
            expiresAt,
            lastSentAt: now,
            verified: false,
            attempts: 0,
        });

        const { linkUrl } = await this.authMagicLinkService.createToken('email', email);

        // Debug config
        const emailConfig = this.configService.get('email');
        this.logger.debug(`Full Email Config: ${JSON.stringify(emailConfig)}`);
        this.logger.debug(`Env EMAIL_ENABLED: ${process.env.EMAIL_ENABLED}`);
        this.logger.debug(`Env EMAIL_API_KEY: ${process.env.EMAIL_API_KEY ? 'Set' : 'Not Set'}`);

        // Send Email
        if (emailConfig?.enabled && emailConfig.api?.key) {
            try {
                await this.sendViaWebApi(email, otpCode, linkUrl, emailConfig);
                this.logger.log(`Email sent successfully to ${email} via Unisender Web API`);
            } catch (error) {
                this.logger.error(`Failed to send email to ${email}: ${error}`);
                throw new Error('Failed to send email');
            }
        } else {
            this.logger.warn(`Email provider not configured, OTP for ${email} is ${otpCode}`);
        }

        return {
            expiresIn: this.otpTtlMinutes * 60,
            canResendAt: Math.floor(now.getTime() / 1000) + this.resendCooldownSeconds,
        };
    }

    /**
     * Send email via Unisender Web API
     * @see https://godocs.unisender.ru/web-api-ref#email-send
     */
    private async sendViaWebApi(email: string, otpCode: string, magicLinkUrl: string, emailConfig: any): Promise<void> {
        const apiUrl = `${emailConfig.api.url}/email/send.json`;
        const apiKey = emailConfig.api.key;

        const payload = {
            message: {
                recipients: [
                    {
                        email: email,
                    },
                ],
                body: {
                    html: `<p>Your login code is: <strong>${otpCode}</strong></p><p>It expires in ${this.otpTtlMinutes} minutes.</p><p>Or <a href="${magicLinkUrl}">sign in instantly</a>.</p>`,
                    plaintext: `Your login code is: ${otpCode}. It expires in ${this.otpTtlMinutes} minutes. Or sign in instantly: ${magicLinkUrl}`,
                },
                subject: 'Your Meriter Login Code',
                from_email: emailConfig.from.address,
                from_name: emailConfig.from.name,
                reply_to: emailConfig.from.address,
            },
        };

        // Debug logging
        this.logger.debug(`Unisender API URL: ${apiUrl}`);
        this.logger.debug(`Unisender API Key: ${apiKey.substring(0, 10)}...`);
        this.logger.debug(`Payload: ${JSON.stringify(payload, null, 2)}`);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': apiKey,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Unisender API error: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        this.logger.log(`Unisender response: ${JSON.stringify(result)}`);
    }

    /**
     * Verify OTP
     */
    async verifyOtp(email: string, code: string): Promise<boolean> {
        // Find latest valid OTP
        const otp = await this.emailOtpModel.findOne({
            email,
            expiresAt: { $gt: new Date() },
            verified: false,
        }).sort({ createdAt: -1 });

        if (!otp) {
            throw new Error('Invalid or expired code. Please request a new one.');
        }

        if (otp.attempts >= this.maxAttemptsPerOtp) {
            throw new Error('Too many failed attempts. Please request a new code.');
        }

        if (otp.otpCode !== code) {
            otp.attempts += 1;
            await otp.save();

            const remainingAttempts = this.maxAttemptsPerOtp - otp.attempts;
            throw new Error(`Invalid code. ${remainingAttempts} attempts remaining.`);
        }

        // Mark as verified
        otp.verified = true;
        await otp.save();

        this.logger.log(`Email OTP verified successfully for ${email}`);
        return true;
    }

    private async checkRateLimit(email: string): Promise<void> {
        const lastOtp = await this.emailOtpModel.findOne({ email }).sort({ createdAt: -1 });

        if (lastOtp) {
            const now = new Date();
            const diffSeconds = (now.getTime() - lastOtp.lastSentAt.getTime()) / 1000;

            if (diffSeconds < this.resendCooldownSeconds) {
                const waitSeconds = Math.ceil(this.resendCooldownSeconds - diffSeconds);
                throw new Error(`Please wait ${waitSeconds} seconds before requesting a new code.`);
            }
        }
    }
}
