import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthMagicLink, AuthMagicLinkDocument } from '../../domain/models/auth/auth-magic-link.schema';
import { AppConfig } from '../../config/configuration';
import { UzzTokenHasher } from '../uzz/security/uzz-token-hasher';


export interface CreateMagicLinkResult {
  token: string;
  linkUrl: string;
}

export interface RedeemMagicLinkResult {
  channel: 'sms' | 'email';
  target: string;
  linkToUserId?: string;
}

/**
 * BC-12 inv-24: one-time magic link persistence.
 * createToken uses magicLink.ttlMinutes (default 15); distinct from SMS OTP 5-minute TTL.
 * redeem is consumed by RedeemMagicLinkUseCase for token validation and mark-used.
 */
@Injectable()
export class AuthMagicLinkService {
  private readonly logger = new Logger(AuthMagicLinkService.name);
  private readonly tokenHasher = new UzzTokenHasher();

  constructor(
    private readonly configService: ConfigService<AppConfig>,
    @InjectModel(AuthMagicLink.name)
    private readonly magicLinkModel: Model<AuthMagicLinkDocument>,
  ) {}

  /**
   * Create a one-time magic link token for the given channel and target.
   * Returns the token and full URL to include in SMS/email.
   * The raw 128-bit token is returned once and only its SHA-256 hash is stored.
   */
  async createToken(
    channel: 'sms' | 'email',
    target: string,
    options?: { linkToUserId?: string; baseUrl?: string; path?: string },
  ): Promise<CreateMagicLinkResult> {
    const magicConfig = this.configService.getOrThrow('magicLink');
    const ttlMs = magicConfig.ttlMinutes * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);
    const { token, tokenHash } = this.tokenHasher.generate();

    await this.magicLinkModel.create({
      tokenHash,
      token: tokenHash,
      channel,
      target,
      expiresAt,
      linkToUserId: options?.linkToUserId,
    });

    const baseUrl = (options?.baseUrl || magicConfig.baseUrl).replace(/\/$/, '');
    const path = (options?.path || magicConfig.path || '/a').replace(/\/$/, '');
    const linkUrl = `${baseUrl}${path}/${token}`;

    this.logger.log(`Magic link created for ${channel} target (expires ${expiresAt.toISOString()})`);
    return { token, linkUrl };
  }

  /**
   * Returns creation time of the most recent link for the given channel/target,
   * or null when none exists. Used for send-rate limiting.
   */
  async getLastCreatedAt(channel: 'sms' | 'email', target: string): Promise<Date | null> {
    const doc = await this.magicLinkModel
      .findOne({ channel, target })
      .sort({ createdAt: -1 })
      .lean<{ createdAt?: Date }>();
    return doc?.createdAt ?? null;
  }

  /**
   * Validate and mark a magic link token used (inv-24: 15-minute expiry at create time).
   * Returns null if token is missing, expired, or already used (same response for all).
   * Session establishment is handled by RedeemMagicLinkUseCase.
   */
  async redeem(token: string): Promise<RedeemMagicLinkResult | null> {
    const now = new Date();
    const doc = await this.magicLinkModel.findOneAndUpdate(
      {
        tokenHash: this.tokenHasher.hash(token),
        usedAt: null,
        expiresAt: { $gt: now },
      },
      { $set: { usedAt: now } },
      { new: true },
    );
    if (!doc) return null;

    this.logger.log(`Magic link redeemed for ${doc.channel}`);
    return {
      channel: doc.channel,
      target: doc.target,
      linkToUserId: doc.linkToUserId,
    };
  }
}
