import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramAuthDataSchema } from '@meriter/shared-types';
import type { z } from 'zod';
import type { AppConfig } from '../../../config/configuration';
import type { AuthProviderPort } from '../../../domain/ports/auth-provider.port';
import type { CookieManager } from '../../../infrastructure/auth/cookie-manager';
import { isTelegramMvpMode } from '../../../common/helpers/product-mode.helper';

export type TelegramAuthInput = z.infer<typeof TelegramAuthDataSchema>;

export type AuthenticateTelegramCommunityResult = {
  user: unknown;
  communityId: string | null;
  jwt: string;
};

@Injectable()
export class AuthenticateTelegramCommunityUseCase {
  private readonly logger = new Logger(AuthenticateTelegramCommunityUseCase.name);

  constructor(
    private readonly authService: AuthProviderPort,
    private readonly cookieManager: CookieManager,
    private readonly configService: ConfigService<AppConfig>,
  ) {}

  async execute(
    input: TelegramAuthInput,
    response: unknown,
    request: unknown,
  ): Promise<AuthenticateTelegramCommunityResult> {
    if (!isTelegramMvpMode(this.configService)) {
      throw new UnauthorizedException(
        'Telegram login for community-web requires MERITER_PRODUCT_MODE=telegram_mvp',
      );
    }

    const parsed = TelegramAuthDataSchema.safeParse(input);
    if (!parsed.success) {
      throw new UnauthorizedException('Invalid Telegram auth payload');
    }

    const result = await this.authService.authenticateTelegramWidget(parsed.data, {
      skipBaseCommunities: true,
    });

    this.cookieManager.establishCommunityJwtAuth(response, result.jwt, request);

    return {
      user: result.user,
      communityId: result.primaryTelegramCommunityId ?? null,
      jwt: result.jwt,
    };
  }
}
