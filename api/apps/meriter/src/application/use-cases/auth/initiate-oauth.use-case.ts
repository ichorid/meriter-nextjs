import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/configuration';

export type OAuthProvider = 'google' | 'yandex';

export class OAuthDisabledError extends Error {
  constructor(public readonly provider: OAuthProvider) {
    super(`${provider === 'google' ? 'Google' : 'Yandex'} OAuth is disabled`);
    this.name = 'OAuthDisabledError';
  }
}

export class OAuthNotConfiguredError extends Error {
  constructor(
    public readonly provider: OAuthProvider,
    public readonly missing: string[],
  ) {
    const label = provider === 'google' ? 'Google' : 'Yandex';
    super(`${label} OAuth not configured. Missing: ${missing.join(', ')}`);
    this.name = 'OAuthNotConfiguredError';
  }
}

export type InitiateOAuthResult = {
  authUrl: string;
  returnTo: string;
};

/**
 * BC-12 inv-09: OAuth provider initiation (Google/Yandex redirect URL construction).
 * REST controller delegates redirect responses to this use case.
 */
@Injectable()
export class InitiateOAuthUseCase {
  constructor(private readonly configService: ConfigService<AppConfig>) {}

  initiateGoogle(returnTo?: string): InitiateOAuthResult {
    const resolvedReturnTo = returnTo || '/meriter/profile';

    const enabled = this.configService.get('oauth')?.google.enabled;
    if (enabled === false) {
      throw new OAuthDisabledError('google');
    }

    const clientId = this.configService.get('oauth')?.google.clientId;
    const callbackUrl =
      this.configService.get('oauth')?.google.redirectUri || process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !callbackUrl) {
      const missing: string[] = [];
      if (!clientId) missing.push('OAUTH_GOOGLE_CLIENT_ID');
      if (!callbackUrl) missing.push('OAUTH_GOOGLE_REDIRECT_URI or OAUTH_GOOGLE_CALLBACK_URL');
      throw new OAuthNotConfiguredError('google', missing);
    }

    const state = JSON.stringify({ returnTo: resolvedReturnTo, return_url: resolvedReturnTo });

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent('email profile')}&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${encodeURIComponent(state)}`;

    return { authUrl, returnTo: resolvedReturnTo };
  }

  initiateYandex(returnTo?: string): InitiateOAuthResult {
    const resolvedReturnTo = returnTo || '/meriter/profile';

    const enabled = this.configService.get('oauth')?.yandex.enabled;
    if (enabled === false) {
      throw new OAuthDisabledError('yandex');
    }

    const clientId = this.configService.get('oauth')?.yandex.clientId;
    const callbackUrl = this.configService.get('oauth')?.yandex.redirectUri;

    if (!clientId || !callbackUrl) {
      const missing: string[] = [];
      if (!clientId) missing.push('OAUTH_YANDEX_CLIENT_ID');
      if (!callbackUrl) missing.push('OAUTH_YANDEX_REDIRECT_URI');
      throw new OAuthNotConfiguredError('yandex', missing);
    }

    const state = JSON.stringify({ returnTo: resolvedReturnTo, return_url: resolvedReturnTo });

    const authUrl =
      `https://oauth.yandex.ru/authorize?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
      `response_type=code&` +
      `state=${encodeURIComponent(state)}`;

    return { authUrl, returnTo: resolvedReturnTo };
  }
}

export function createInitiateOAuthUseCase(deps: {
  configService: ConfigService<AppConfig>;
}): InitiateOAuthUseCase {
  return new InitiateOAuthUseCase(deps.configService);
}
