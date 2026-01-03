import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import { AppConfig } from '../../config/configuration';
import { EmailOtp, EmailOtpDocument } from '../../domain/models/auth/email-otp.schema';

@Injectable()
export class EmailProviderService {
    private readonly logger = new Logger(EmailProviderService.name);
    private transporter: nodemailer.Transporter | null = null;
    private readonly maxAttemptsPerOtp = 3;
    private readonly otpTtlMinutes = 15;
    private readonly resendCooldownSeconds = 60;

    constructor(
        private readonly configService: ConfigService<AppConfig>,
        @InjectModel(EmailOtp.name) private emailOtpModel: Model<EmailOtpDocument>,
    ) {
        this.initTransporter();
    }

    private initTransporter() {
        const emailConfig = this.configService.get('email');
        if (emailConfig?.enabled && emailConfig.smtp) {
            this.transporter = nodemailer.createTransport({
                host: emailConfig.smtp.host,
                port: emailConfig.smtp.port,
                secure: emailConfig.smtp.secure, // true for 465, false for other ports
                auth: {
                    user: emailConfig.smtp.user,
                    pass: emailConfig.smtp.pass,
                },
            });
        }
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

        // Send Email
        if (this.transporter) {
            try {
                const info = await this.transporter.sendMail({
                    from: `"Meriter" <${this.configService.get('email')?.smtp?.user}>`,
                    to: email,
                    subject: 'Your Meriter Login Code',
                    text: `Your login code is: ${otpCode}. It expires in ${this.otpTtlMinutes} minutes.`,
                    html: `<p>Your login code is: <strong>${otpCode}</strong></p><p>It expires in ${this.otpTtlMinutes} minutes.</p>`,
                });
                this.logger.log(`Email sent: ${info.messageId}`);
            } catch (error) {
                this.logger.error(`Failed to send email to ${email}: ${error}`);
                throw new Error('Failed to send email');
            }
        } else {
            this.logger.warn(`Email provider not configured, OTP for ${email} is ${otpCode}`);
            // In dev, we might verify even without sending real email, but ideally config should be there.
        }

        return {
            expiresIn: this.otpTtlMinutes * 60,
            canResendAt: Math.floor(now.getTime() / 1000) + this.resendCooldownSeconds,
        };
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
