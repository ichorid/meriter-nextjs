import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthProviderPort } from '../../../domain/ports/auth-provider.port';
import { AppConfig } from '../../../config/configuration';
import { CookieManager } from '../../../infrastructure/auth/cookie-manager';

export class FakeAuthDisabledError extends Error {
  constructor() {
    super('Fake data mode or test auth mode is not enabled');
    this.name = 'FakeAuthDisabledError';
  }
}

export type EstablishSessionRequest = {
  cookies?: Record<string, string | undefined>;
};

export type FakeAuthSessionResult = {
  user: unknown;
  hasPendingCommunities: boolean;
};

type FakeSessionCookieName = 'fake_user_id' | 'fake_superadmin_id';

/**
 * BC-12 inv-09: centralized JWT/session cookie establishment for REST and tRPC.
 * inv-23: fake auth gating (fakeDataMode || testAuthMode) shared across transports.
 */
@Injectable()
export class EstablishSessionUseCase {
  constructor(
    private readonly cookieManager: CookieManager,
    private readonly configService: ConfigService<AppConfig>,
    private readonly authService: AuthProviderPort,
  ) {}

  /** inv-23: fake/superadmin auth allowed when fakeDataMode or testAuthMode is enabled. */
  isFakeAuthEnabled(): boolean {
    const fakeDataMode = this.configService.get('dev')?.fakeDataMode ?? false;
    const testAuthMode = this.configService.get('dev')?.testAuthMode ?? false;
    return fakeDataMode || testAuthMode;
  }

  assertFakeAuthEnabled(): void {
    if (!this.isFakeAuthEnabled()) {
      throw new FakeAuthDisabledError();
    }
  }

  /** Post-OTP, passkey, mock, magic-link: full JWT cookie clear before set. */
  establishJwtSession(response: unknown, jwt: string, request: unknown): void {
    this.cookieManager.establishJwtAuth(response, jwt, request, 'full');
  }

  /** OAuth callback: host-only JWT clear before set. */
  establishOAuthSession(response: unknown, jwt: string, request: unknown): void {
    this.cookieManager.establishJwtAuth(response, jwt, request, 'oauth');
  }

  async authenticateFakeUser(
    request: EstablishSessionRequest,
    response: unknown,
  ): Promise<FakeAuthSessionResult> {
    this.assertFakeAuthEnabled();

    const fakeUserId = this.resolveOrCreateFakeId(request, 'fake_user_id', 'fake_user');
    const result = await this.authService.authenticateFakeUser(fakeUserId);

    this.establishJwtSession(response, result.jwt, request);
    this.cookieManager.setAuthSessionCookie(response, 'fake_user_id', fakeUserId, request);

    return {
      user: result.user,
      hasPendingCommunities: result.hasPendingCommunities,
    };
  }

  async authenticateFakeSuperadmin(
    request: EstablishSessionRequest,
    response: unknown,
  ): Promise<FakeAuthSessionResult> {
    this.assertFakeAuthEnabled();

    const fakeUserId = this.resolveOrCreateFakeId(
      request,
      'fake_superadmin_id',
      'fake_superadmin',
    );
    const result = await this.authService.authenticateFakeSuperadmin(fakeUserId);

    this.establishJwtSession(response, result.jwt, request);
    this.cookieManager.setAuthSessionCookie(
      response,
      'fake_superadmin_id',
      fakeUserId,
      request,
    );

    return {
      user: result.user,
      hasPendingCommunities: result.hasPendingCommunities,
    };
  }

  async authenticateDemoPersona(
    response: unknown,
    request: EstablishSessionRequest,
    authId: string,
  ): Promise<FakeAuthSessionResult> {
    const result = await this.authService.authenticateDemoPersona(authId);
    this.establishJwtSession(response, result.jwt, request);
    return {
      user: result.user,
      hasPendingCommunities: result.hasPendingCommunities,
    };
  }

  private resolveOrCreateFakeId(
    request: EstablishSessionRequest,
    cookieName: FakeSessionCookieName,
    idPrefix: string,
  ): string {
    const existing = request.cookies?.[cookieName];
    if (existing) {
      return existing;
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${idPrefix}_${timestamp}_${random}`;
  }
}

export function createEstablishSessionUseCase(deps: {
  cookieManager: CookieManager;
  configService: ConfigService<AppConfig>;
  authService: AuthProviderPort;
}): EstablishSessionUseCase {
  return new EstablishSessionUseCase(deps.cookieManager, deps.configService, deps.authService);
}
