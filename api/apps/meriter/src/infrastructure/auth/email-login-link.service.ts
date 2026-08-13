import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { AuthMagicLinkService } from './magic-link-auth.service';
import type { EmailLoginLinkSendResult } from '../../domain/ports/email-login-link.port';

/**
 * BC-12: email login via one-time magic link.
 * Sends an email containing a short sign-in link (no OTP code);
 * the link is redeemed by GET /api/v1/auth/link/:token.
 */
@Injectable()
export class EmailLoginLinkService {
    private readonly logger = new Logger(EmailLoginLinkService.name);
    private readonly resendCooldownSeconds = 60;

    constructor(
        private readonly configService: ConfigService<AppConfig>,
        private readonly authMagicLinkService: AuthMagicLinkService,
    ) {}

    async sendLoginLink(
        email: string,
        options?: {
            linkToUserId?: string;
            baseUrl?: string;
            path?: string;
            productLabel?: string;
        },
    ): Promise<EmailLoginLinkSendResult> {
        await this.checkRateLimit(email);

        const { linkUrl } = await this.authMagicLinkService.createToken('email', email, {
            linkToUserId: options?.linkToUserId,
            baseUrl: options?.baseUrl,
            path: options?.path,
        });
        const ttlMinutes = this.configService.getOrThrow('magicLink').ttlMinutes;
        const product = options?.productLabel?.trim() || 'Meriter';

        const html = [
            '<p>Здравствуйте!</p>',
            `<p>Чтобы войти в ${product}, нажмите на ссылку:</p>`,
            `<p><a href="${linkUrl}" style="display:inline-block;padding:10px 20px;background:#A855F7;color:#ffffff;text-decoration:none;border-radius:8px;">Войти в ${product}</a></p>`,
            `<p>Или скопируйте адрес в браузер: <a href="${linkUrl}">${linkUrl}</a></p>`,
            `<p>Ссылка действует ${ttlMinutes} минут и сработает только один раз.</p>`,
            '<p>Если вы не запрашивали вход, просто проигнорируйте это письмо.</p>',
        ].join('');
        const plaintext =
            `Чтобы войти в ${product}, перейдите по ссылке: ${linkUrl}\n` +
            `Ссылка действует ${ttlMinutes} минут и сработает только один раз.\n` +
            `Если вы не запрашивали вход, просто проигнорируйте это письмо.`;

        try {
            const sent = await this.sendHtmlEmail(email, `Вход в ${product}`, html, plaintext);
            if (!sent) {
                this.logger.warn(`Email provider not configured, login link for ${email}: ${linkUrl}`);
            }
        } catch (error) {
            this.logger.error(`Failed to send login link email to ${email}: ${error}`);
            throw new Error('Failed to send email');
        }

        return {
            expiresIn: ttlMinutes * 60,
            canResendAt: Math.floor(Date.now() / 1000) + this.resendCooldownSeconds,
        };
    }

    /**
     * Send an HTML email via Unisender. Returns false if email is not configured.
     * @see https://godocs.unisender.ru/web-api-ref#email-send
     */
    async sendHtmlEmail(
        to: string,
        subject: string,
        html: string,
        plaintext: string,
    ): Promise<boolean> {
        const emailConfig = this.configService.get('email');
        if (!emailConfig?.enabled || !emailConfig.api?.key) {
            return false;
        }

        const apiUrl = `${emailConfig.api.url}/email/send.json`;
        const payload = {
            message: {
                recipients: [{ email: to }],
                body: { html, plaintext },
                subject,
                from_email: emailConfig.from.address,
                from_name: emailConfig.from.name,
                reply_to: emailConfig.from.address,
            },
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': emailConfig.api.key,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Unisender API error: ${response.status} ${errorText}`);
        }

        this.logger.log(`Email sent to ${to}: ${subject}`);
        return true;
    }

    private async checkRateLimit(email: string): Promise<void> {
        const lastSentAt = await this.authMagicLinkService.getLastCreatedAt('email', email);
        if (!lastSentAt) return;

        const diffSeconds = (Date.now() - lastSentAt.getTime()) / 1000;
        if (diffSeconds < this.resendCooldownSeconds) {
            const waitSeconds = Math.ceil(this.resendCooldownSeconds - diffSeconds);
            throw new Error(`Please wait ${waitSeconds} seconds before requesting a new link.`);
        }
    }
}
