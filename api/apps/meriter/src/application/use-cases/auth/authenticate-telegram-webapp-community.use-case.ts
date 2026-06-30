import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramWebAppDataSchema } from '@meriter/shared-types';
import type { z } from 'zod';
import type { AppConfig } from '../../../config/configuration';
import type { AuthProviderPort } from '../../../domain/ports/auth-provider.port';
import type { CookieManager } from '../../../infrastructure/auth/cookie-manager';
import { isTelegramMvpMode } from '../../../common/helpers/product-mode.helper';
import { EnsureTelegramCommunityMemberUseCase } from '../communities/ensure-telegram-community-member.use-case';

export type TelegramWebAppAuthInput = z.infer<typeof TelegramWebAppDataSchema>;

export type AuthenticateTelegramWebAppCommunityResult = {
  user: unknown;
  communityId: string | null;
  jwt: string;
  telegramChatId: string | null;
  startParam: string | null;
};

@Injectable()
export class AuthenticateTelegramWebAppCommunityUseCase {
  private readonly logger = new Logger(AuthenticateTelegramWebAppCommunityUseCase.name);

  constructor(
    private readonly authService: AuthProviderPort,
    private readonly cookieManager: CookieManager,
    private readonly configService: ConfigService<AppConfig>,
    private readonly ensureTelegramMember: EnsureTelegramCommunityMemberUseCase,
  ) {}

  async execute(
    input: TelegramWebAppAuthInput,
    response: unknown,
    request: unknown,
  ): Promise<AuthenticateTelegramWebAppCommunityResult> {
    if (!isTelegramMvpMode(this.configService)) {
      throw new UnauthorizedException(
        'Telegram Web App login requires MERITER_PRODUCT_MODE=telegram_mvp',
      );
    }

    const parsed = TelegramWebAppDataSchema.safeParse(input);
    if (!parsed.success) {
      throw new UnauthorizedException('Invalid Telegram Web App payload');
    }

    const result = await this.authService.authenticateTelegramWebApp(
      parsed.data.initData,
      { skipBaseCommunities: true },
    );

    this.cookieManager.establishCommunityJwtAuth(response, result.jwt, request);

    const communityId = result.primaryTelegramCommunityId ?? null;
    const userId = (result.user as { id?: string }).id;
    if (userId && communityId) {
      await this.ensureTelegramMember.execute(userId, communityId);
    }

    return {
      user: result.user,
      communityId,
      jwt: result.jwt,
      telegramChatId: result.telegramChatId,
      startParam: result.startParam,
    };
  }
}
