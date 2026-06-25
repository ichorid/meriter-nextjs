import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../config/configuration';
import type { AuthProviderPort } from '../../../domain/ports/auth-provider.port';
import type { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import type { UserService } from '../../../domain/services/user.service';
import type { CookieManager } from '../../../infrastructure/auth/cookie-manager';
import { isTelegramMvpMode } from '../../../common/helpers/product-mode.helper';

export type AuthenticateFakeCommunityResult = {
  user: unknown;
  communityId: string | null;
  jwt: string;
};

type EstablishSessionRequest = {
  cookies?: Record<string, string | undefined>;
};

@Injectable()
export class AuthenticateFakeCommunityUseCase {
  constructor(
    private readonly authService: AuthProviderPort,
    private readonly cookieManager: CookieManager,
    private readonly configService: ConfigService<AppConfig>,
    private readonly userService: UserService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
  ) {}

  private isFakeAuthEnabled(): boolean {
    const fakeDataMode = this.configService.get('dev')?.fakeDataMode ?? false;
    const testAuthMode = this.configService.get('dev')?.testAuthMode ?? false;
    return fakeDataMode || testAuthMode;
  }

  async execute(
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

    const fakeUserId = this.resolveOrCreateFakeId(request);
    const result = await this.authService.authenticateFakeCommunityUser(fakeUserId);

    const defaultCommunityId =
      this.configService.get('app')?.defaultTelegramCommunityId?.trim() || null;
    if (defaultCommunityId) {
      await this.ensureDevCommunityMembership(result.user.id, defaultCommunityId);
    }

    this.cookieManager.establishCommunityJwtAuth(response, result.jwt, request);

    const communityId =
      result.primaryTelegramCommunityId ?? defaultCommunityId ?? null;

    return {
      user: result.user,
      communityId,
      jwt: result.jwt,
    };
  }

  private resolveOrCreateFakeId(request: EstablishSessionRequest): string {
    const existing = request.cookies?.community_fake_user_id;
    if (existing) return existing;

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `community_fake_${timestamp}_${random}`;
  }

  private async ensureDevCommunityMembership(
    userId: string,
    communityId: string,
  ): Promise<void> {
    const memberships = await this.userService.getUserCommunities(userId);
    if (!memberships.includes(communityId)) {
      await this.userService.addCommunityMembership(userId, communityId);
    }

    const role = await this.userCommunityRoleService.getRole(userId, communityId);
    if (!role) {
      await this.userCommunityRoleService.setRole(userId, communityId, 'participant');
    }
  }
}
