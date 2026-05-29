import { Injectable } from '@nestjs/common';
import type { MagicLinkAuthPort } from '../../../domain/ports/magic-link-auth.port';
import type { RedeemMagicLinkResult as MagicLinkTokenRedeemResult } from '../../../domain/ports/magic-link-auth.port';
import type { AuthProviderPort } from '../../../domain/ports/auth-provider.port';
import { EstablishSessionUseCase } from './establish-session.use-case';

export type RedeemMagicLinkResult = {
  user: unknown;
  isNewUser: boolean;
  channel: MagicLinkTokenRedeemResult['channel'];
};

/**
 * BC-12 inv-24: magic link redeem + session establishment.
 * Token validation and mark-used delegate to AuthMagicLinkService (15-minute TTL via
 * magicLink.ttlMinutes, default 15; distinct from SMS OTP 5-minute TTL).
 * Web routes /a/[token] and /auth/link/[token] both proxy to GET /api/v1/auth/link/:token
 * (Phase 7 consolidation).
 */
@Injectable()
export class RedeemMagicLinkUseCase {
  constructor(
    private readonly authMagicLinkService: MagicLinkAuthPort,
    private readonly authService: AuthProviderPort,
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
      isNewUser: authResult.isNewUser,
      channel: tokenResult.channel,
    };
  }
}

export function createRedeemMagicLinkUseCase(deps: {
  authMagicLinkService: MagicLinkAuthPort;
  authService: AuthProviderPort;
  establishSessionUseCase: EstablishSessionUseCase;
}): RedeemMagicLinkUseCase {
  return new RedeemMagicLinkUseCase(
    deps.authMagicLinkService,
    deps.authService,
    deps.establishSessionUseCase,
  );
}
