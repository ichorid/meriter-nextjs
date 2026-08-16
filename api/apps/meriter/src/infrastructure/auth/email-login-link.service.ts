import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { AuthMagicLinkService } from './magic-link-auth.service';
import type { EmailLoginLinkSendResult } from '../../domain/ports/email-login-link.port';
import {
  UZZ_RATE_LIMITER_PORT,
  UzzRateLimiterPort,
  consumeUzzRateLimit,
} from '../../application/uzz/ports/uzz-identity.port';
import { UzzTokenHasher } from '../uzz/security/uzz-token-hasher';

export class EmailDeliveryUnavailableError extends Error {
    readonly code = 'EMAIL_DELIVERY_UNAVAILABLE';

    constructor() {
        super('EMAIL_DELIVERY_UNAVAILABLE');
        this.name = 'EmailDeliveryUnavailableError';
    }
}

export type EmailProviderResult = {
    delivered: boolean;
    providerRequestId?: string;
};

/**
 * BC-12: email login via one-time magic link.
 * Sends an email containing a short sign-in link (no OTP code);
 * the link is redeemed by GET /api/v1/auth/link/:token.
 */
@Injectable()
export class EmailLoginLinkService {
    private readonly logger = new Logger(EmailLoginLinkService.name);
    private readonly resendCooldownSeconds = 60;
    private readonly tokenHasher = new UzzTokenHasher();

    constructor(
        private readonly configService: ConfigService<AppConfig>,
        private readonly authMagicLinkService: AuthMagicLinkService,
        @Inject(UZZ_RATE_LIMITER_PORT)
        private readonly rateLimiter: UzzRateLimiterPort,
    ) {}

    async sendLoginLink(
        email: string,
        options?: {
            linkToUserId?: string;
            baseUrl?: string;
            path?: string;
            productLabel?: string;
            clientIp?: string;
            now?: Date;
        },
    ): Promise<EmailLoginLinkSendResult> {
        const normalizedEmail = email.trim().toLowerCase();
        const now = options?.now ?? new Date();
        await this.consumeSendLimits(normalizedEmail, options?.clientIp, now);

        const { linkUrl } = await this.authMagicLinkService.createToken(
            'email',
            normalizedEmail,
            {
                linkToUserId: options?.linkToUserId,
                baseUrl: options?.baseUrl,
                path: options?.path,
            },
        );
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

        const emailConfig = this.configService.get('email');
        const nodeEnv = this.configService.get('app')?.env
          ?? this.configService.get('NODE_ENV')
          ?? process.env.NODE_ENV;
        if (nodeEnv === 'development' && !emailConfig?.api?.key) {
            return {
                expiresIn: ttlMinutes * 60,
                canResendAt: Math.floor(now.getTime() / 1000) + this.resendCooldownSeconds,
                devLoginUrl: linkUrl,
            };
        }

        let providerResult: EmailProviderResult;
        try {
            providerResult = normalizeEmailProviderResult(
                await this.sendHtmlEmail(
                    normalizedEmail,
                    `Вход в ${product}`,
                    html,
                    plaintext,
                ),
            );
        } catch {
            this.logger.warn({
                event: 'uzz_magic_link_delivery_failed',
                subjectHash: this.tokenHasher.hash(normalizedEmail),
            });
            throw new EmailDeliveryUnavailableError();
        }

        if (!providerResult.delivered) {
            this.logger.warn({
                event: 'uzz_magic_link_delivery_failed',
                subjectHash: this.tokenHasher.hash(normalizedEmail),
                providerRequestId: providerResult.providerRequestId,
            });
            throw new EmailDeliveryUnavailableError();
        }

        return {
            expiresIn: ttlMinutes * 60,
            canResendAt: Math.floor(now.getTime() / 1000) + this.resendCooldownSeconds,
        };
    }

    /**
     * Send an HTML email via Unisender.
     * @see https://godocs.unisender.ru/web-api-ref#email-send
     */
    async sendHtmlEmail(
        to: string,
        subject: string,
        html: string,
        plaintext: string,
    ): Promise<EmailProviderResult> {
        const emailConfig = this.configService.get('email');
        if (!emailConfig?.enabled || !emailConfig.api?.key) {
            return { delivered: false };
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

        const providerRequestId = await readProviderRequestId(response);

        if (!response.ok) {
            return { delivered: false, providerRequestId };
        }

        return { delivered: true, providerRequestId };
    }

    private async consumeSendLimits(
        normalizedEmail: string,
        clientIp: string | undefined,
        now: Date,
    ): Promise<void> {
        const emailHash = this.tokenHasher.hash(normalizedEmail);
        await consumeUzzRateLimit(this.rateLimiter, {
            scope: 'magic-link-send-email-cooldown',
            subjectHash: emailHash,
            limit: 1,
            windowMs: 60_000,
            now,
        });
        await consumeUzzRateLimit(this.rateLimiter, {
            scope: 'magic-link-send-email-hour',
            subjectHash: emailHash,
            limit: 5,
            windowMs: 60 * 60 * 1000,
            now,
        });
        const trustedIp = trustedClientIp(clientIp);
        if (!trustedIp) {
            return;
        }
        await consumeUzzRateLimit(this.rateLimiter, {
            scope: 'magic-link-send-ip-hour',
            subjectHash: this.tokenHasher.hash(trustedIp),
            limit: 20,
            windowMs: 60 * 60 * 1000,
            now,
        });
    }
}

function trustedClientIp(clientIp: string | undefined): string | undefined {
    const value = clientIp?.trim();
    if (!value || value.toLowerCase() === 'unknown') {
        return undefined;
    }
    return value;
}

function normalizeEmailProviderResult(
    result: boolean | EmailProviderResult,
): EmailProviderResult {
    if (typeof result === 'boolean') {
        return { delivered: result };
    }
    return {
        delivered: result.delivered === true,
        providerRequestId: result.providerRequestId,
    };
}

async function readProviderRequestId(
    response: Response,
): Promise<string | undefined> {
    const raw = await response.text();
    if (!raw) {
        return undefined;
    }
    try {
        return extractProviderRequestId(JSON.parse(raw) as unknown);
    } catch {
        return undefined;
    }
}

function extractProviderRequestId(payload: unknown): string | undefined {
    if (!payload || typeof payload !== 'object') {
        return undefined;
    }
    const record = payload as Record<string, unknown>;
    if (typeof record.job_id === 'string' && record.job_id) {
        return record.job_id;
    }
    if (typeof record.request_id === 'string' && record.request_id) {
        return record.request_id;
    }
    const nested = record.result;
    if (nested && typeof nested === 'object') {
        const nestedRecord = nested as Record<string, unknown>;
        if (typeof nestedRecord.job_id === 'string' && nestedRecord.job_id) {
            return nestedRecord.job_id;
        }
        if (typeof nestedRecord.request_id === 'string' && nestedRecord.request_id) {
            return nestedRecord.request_id;
        }
    }
    return undefined;
}
