import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MagicLinkAuthPort } from '../../../domain/ports/magic-link-auth.port';
import type { RedeemMagicLinkResult as MagicLinkTokenRedeemResult } from '../../../domain/ports/magic-link-auth.port';
import type { AuthProviderPort } from '../../../domain/ports/auth-provider.port';
import { UserService } from '../../../domain/services/user.service';
import { JwtService } from '../../../common/utils/jwt-service.util';
import { AppConfig } from '../../../config/configuration';
import { EstablishSessionUseCase } from './establish-session.use-case';

export type RedeemMagicLinkResult = {
  user: unknown;
  isNewUser: boolean;
  channel: MagicLinkTokenRedeemResult['channel'];
};

@Injectable()
export class RedeemMagicLinkUseCase {
  constructor(
    private readonly authMagicLinkService: MagicLinkAuthPort,
    private readonly authService: AuthProviderPort,
    private readonly userService: UserService,
    private readonly configService: ConfigService<AppConfig>,
    private readonly establishSessionUseCase: EstablishSessionUseCase,
  ) {}

  async redeem(params: {
    token: string;
    request: unknown;
    response: unknown;
  }): Promise<RedeemMagicLinkResult | null> {
    const tokenResult = await this.authMagicLinkService.redeem(params.token);
    if (!tokenResult) {
      return null;
    }

    if (tokenResult.linkToUserId && tokenResult.channel === 'email') {
      const existing = await this.userService.getUserByAuthId('email', tokenResult.target);
      if (existing && existing.id !== tokenResult.linkToUserId) {
        return null;
      }

      await this.userService.linkIdentity(
        tokenResult.linkToUserId,
        'email',
        tokenResult.target,
      );

      const user = await this.userService.getUserById(tokenResult.linkToUserId);
      if (!user) {
        return null;
      }

      const jwt = JwtService.generateTokenFromConfig(
        user.id,
        user.authProvider,
        user.authId,
        user.communityTags || [],
        this.configService,
      );

      this.establishSessionUseCase.establishJwtSession(params.response, jwt, params.request);

      return {
        user,
        isNewUser: false,
        channel: tokenResult.channel,
      };
    }

    const authResult =
      tokenResult.channel === 'sms'
        ? await this.authService.authenticateSms(tokenResult.target)
        : await this.authService.authenticateEmail(tokenResult.target);

    this.establishSessionUseCase.establishJwtSession(
      params.response,
      authResult.jwt,
      params.request,
    );

    return {
      user: authResult.user,
      isNewUser: authResult.isNewUser ?? false,
      channel: tokenResult.channel,
    };
  }
}

export function createRedeemMagicLinkUseCase(deps: {
  authMagicLinkService: MagicLinkAuthPort;
  authService: AuthProviderPort;
  userService: UserService;
  configService: ConfigService<AppConfig>;
  establishSessionUseCase: EstablishSessionUseCase;
}): RedeemMagicLinkUseCase {
  return new RedeemMagicLinkUseCase(
    deps.authMagicLinkService,
    deps.authService,
    deps.userService,
    deps.configService,
    deps.establishSessionUseCase,
  );
}
