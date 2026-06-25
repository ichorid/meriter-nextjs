import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../config/configuration';
import type { AuthProviderPort } from '../../../domain/ports/auth-provider.port';
import type { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import type { UserService } from '../../../domain/services/user.service';
import type { WalletService } from '../../../domain/services/wallet.service';
import type { CookieManager } from '../../../infrastructure/auth/cookie-manager';
import { isTelegramMvpMode } from '../../../common/helpers/product-mode.helper';
import {
  COMMUNITY_WEB_DEV_LEAD_AUTH_ID,
  COMMUNITY_WEB_DEV_PARTICIPANT_AUTH_ID,
  resolveDevCommunityId,
} from '../../../domain/common/constants/community-web-dev.constants';

export type CommunityWebDevPersona = 'lead' | 'participant';

export type AuthenticateFakeCommunityInput = {
  persona?: CommunityWebDevPersona;
};

export type AuthenticateFakeCommunityResult = {
  user: unknown;
  communityId: string | null;
  jwt: string;
};

type EstablishSessionRequest = {
  cookies?: Record<string, string | undefined>;
};

const DEV_CURRENCY = {
  singular: 'заслуга',
  plural: 'заслуги',
  genitive: 'заслуг',
} as const;

@Injectable()
export class AuthenticateFakeCommunityUseCase {
  constructor(
    private readonly authService: AuthProviderPort,
    private readonly cookieManager: CookieManager,
    private readonly configService: ConfigService<AppConfig>,
    private readonly userService: UserService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly walletService: WalletService,
  ) {}

  private isFakeAuthEnabled(): boolean {
    const fakeDataMode = this.configService.get('dev')?.fakeDataMode ?? false;
    const testAuthMode = this.configService.get('dev')?.testAuthMode ?? false;
    return fakeDataMode || testAuthMode;
  }

  async execute(
    input: AuthenticateFakeCommunityInput,
    request: EstablishSessionRequest,
    response: unknown,
  ): Promise<AuthenticateFakeCommunityResult> {
    if (!this.isFakeAuthEnabled()) {
      throw new UnauthorizedException(
        'Dev login requires FAKE_DATA_MODE or TEST_AUTH_MODE',
      );
    }

    if (!isTelegramMvpMode(this.configService)) {
      throw new UnauthorizedException(
        'Community-web dev login requires MERITER_PRODUCT_MODE=telegram_mvp',
      );
    }

    const persona = input.persona ?? 'participant';
    const authId = this.resolveAuthId(persona, request);
    const role = persona === 'lead' ? 'lead' : 'participant';

    const result = await this.authService.authenticateFakeCommunityUser(authId);

    const communityId = resolveDevCommunityId(
      this.configService.get('app')?.defaultTelegramCommunityId,
    );

    await this.ensureDevCommunityMembership(result.user.id, communityId, role);
    await this.walletService.createOrGetWallet(
      result.user.id,
      communityId,
      DEV_CURRENCY,
    );

    this.cookieManager.establishCommunityJwtAuth(response, result.jwt, request);

    return {
      user: result.user,
      communityId,
      jwt: result.jwt,
    };
  }

  private resolveAuthId(
    persona: CommunityWebDevPersona,
    request: EstablishSessionRequest,
  ): string {
    if (persona === 'lead') {
      return COMMUNITY_WEB_DEV_LEAD_AUTH_ID;
    }
    if (persona === 'participant') {
      return COMMUNITY_WEB_DEV_PARTICIPANT_AUTH_ID;
    }

    const existing = request.cookies?.community_fake_user_id;
    if (existing) return existing;

    return COMMUNITY_WEB_DEV_PARTICIPANT_AUTH_ID;
  }

  private async ensureDevCommunityMembership(
    userId: string,
    communityId: string,
    role: 'lead' | 'participant',
  ): Promise<void> {
    const memberships = await this.userService.getUserCommunities(userId);
    if (!memberships.includes(communityId)) {
      await this.userService.addCommunityMembership(userId, communityId);
    }

    const currentRole = await this.userCommunityRoleService.getRole(
      userId,
      communityId,
    );
    if (currentRole?.role !== role) {
      await this.userCommunityRoleService.setRole(userId, communityId, role);
    }
  }
}
