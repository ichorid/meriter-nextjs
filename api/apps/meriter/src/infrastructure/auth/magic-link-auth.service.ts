import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { AuthMagicLink, AuthMagicLinkDocument } from '../../domain/models/auth/auth-magic-link.schema';
import { AppConfig } from '../../config/configuration';


export interface CreateMagicLinkResult {
  token: string;
  linkUrl: string;
}

export interface RedeemMagicLinkResult {
  channel: 'sms' | 'email';
  target: string;
}

/**
 * BC-12 inv-24: one-time magic link persistence.
 * createToken uses magicLink.ttlMinutes (default 15); distinct from SMS OTP 5-minute TTL.
 * redeem is consumed by RedeemMagicLinkUseCase for token validation and mark-used.
 */
@Injectable()
export class AuthMagicLinkService {
  private readonly logger = new Logger(AuthMagicLinkService.name);

  constructor(
    private readonly configService: ConfigService<AppConfig>,
    @InjectModel(AuthMagicLink.name)
    private readonly magicLinkModel: Model<AuthMagicLinkDocument>,
  ) {}

  /**
   * Create a one-time magic link token for the given channel and target.
   * Returns the token and full URL to include in SMS/email.
   */
  async createToken(channel: 'sms' | 'email', target: string): Promise<CreateMagicLinkResult> {
    const magicConfig = this.configService.getOrThrow('magicLink');
    const ttlMs = magicConfig.ttlMinutes * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);
    const token = randomBytes(16).toString('hex');

    await this.magicLinkModel.create({
      token,
      channel,
      target,
      expiresAt,
    });

    const baseUrl = magicConfig.baseUrl.replace(/\/$/, '');
    const path = (magicConfig.path || '/a').replace(/\/$/, '');
    const linkUrl = `${baseUrl}${path}/${token}`;

    this.logger.log(`Magic link created for ${channel} target (expires ${expiresAt.toISOString()})`);
    return { token, linkUrl };
  }

  /**
   * Validate and mark a magic link token used (inv-24: 15-minute expiry at create time).
   * Returns null if token is missing, expired, or already used (same response for all).
   * Session establishment is handled by RedeemMagicLinkUseCase.
   */
  async redeem(token: string): Promise<RedeemMagicLinkResult | null> {
    const doc = await this.magicLinkModel.findOne({ token });
    if (!doc) return null;
    if (doc.usedAt) return null;
    if (doc.expiresAt < new Date()) return null;

    doc.usedAt = new Date();
    await doc.save();

    this.logger.log(`Magic link redeemed for ${doc.channel}`);
    return { channel: doc.channel, target: doc.target };
  }
}
