import { Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramAuthDataSchema } from '@meriter/shared-types';
import type { z } from 'zod';
import type { AppConfig } from '../../../config/configuration';
import type { AuthProviderPort } from '../../../domain/ports/auth-provider.port';
import type { CookieManager } from '../../../infrastructure/auth/cookie-manager';

export type TelegramAuthInput = z.infer<typeof TelegramAuthDataSchema>;

export type AuthenticateTelegramMeriterResult = {
  user: unknown;
  isNewUser: boolean;
  jwt: string;
};

@Injectable()
export class AuthenticateTelegramMeriterUseCase {
  constructor(
    private readonly authService: AuthProviderPort,
    private readonly cookieManager: CookieManager,
    private readonly configService: ConfigService<AppConfig>,
  ) {}

  async execute(
    input: TelegramAuthInput,
    response: unknown,
    request: unknown,
  ): Promise<AuthenticateTelegramMeriterResult> {
    const telegramEnabled = this.configService.get('oauth.telegram.enabled', false);
    if (!telegramEnabled) {
      throw new ForbiddenException('Telegram login is not enabled');
    }

    const parsed = TelegramAuthDataSchema.safeParse(input);
    if (!parsed.success) {
      throw new UnauthorizedException('Invalid Telegram auth payload');
    }

    const result = await this.authService.authenticateTelegramWidget(parsed.data, {
      meriterSession: true,
    });

    this.cookieManager.establishJwtAuth(response, result.jwt, request);

    return {
      user: result.user,
      isNewUser: result.isNewUser,
      jwt: result.jwt,
    };
  }
}
