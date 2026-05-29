import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthProviderPort } from '../../../domain/ports/auth-provider.port';
import { AppConfig } from '../../../config/configuration';
import { EstablishSessionUseCase } from './establish-session.use-case';

export type OAuthCallbackProvider = 'google' | 'yandex';

export class OAuthAuthorizationCodeMissingError extends Error {
  constructor() {
    super('Authorization code not provided');
    this.name = 'OAuthAuthorizationCodeMissingError';
  }
}

export type CompleteOAuthCallbackResult = {
  redirectUrl: string;
  isNewUser: boolean;
};

/**
 * BC-12 inv-09: OAuth callback completion (code exchange, session establishment, redirect).
 * Delegates token exchange and user provisioning to AuthProviderService.authenticateGoogle/Yandex.
 */
@Injectable()
export class CompleteOAuthCallbackUseCase {
  constructor(
    private readonly configService: ConfigService<AppConfig>,
    private readonly authService: AuthProviderPort,
    private readonly establishSessionUseCase: EstablishSessionUseCase,
  ) {}

  async completeGoogleCallback(params: {
    code: string | undefined;
    response: unknown;
    request: unknown;
  }): Promise<CompleteOAuthCallbackResult> {
    return this.completeCallback('google', params);
  }

  async completeYandexCallback(params: {
    code: string | undefined;
    response: unknown;
    request: unknown;
  }): Promise<CompleteOAuthCallbackResult> {
    return this.completeCallback('yandex', params);
  }

  buildLoginErrorRedirectUrl(errorMessage: string): string {
    return this.buildWebUrl(`/meriter/login?error=${encodeURIComponent(errorMessage)}`);
  }

  private async completeCallback(
    provider: OAuthCallbackProvider,
    params: {
      code: string | undefined;
      response: unknown;
      request: unknown;
    },
  ): Promise<CompleteOAuthCallbackResult> {
    if (!params.code) {
      throw new OAuthAuthorizationCodeMissingError();
    }

    const result =
      provider === 'google'
        ? await this.authService.authenticateGoogle(params.code)
        : await this.authService.authenticateYandex(params.code);

    this.establishSessionUseCase.establishOAuthSession(
      params.response,
      result.jwt,
      params.request,
    );

    const redirectPath = result.isNewUser ? '/meriter/welcome' : '/meriter/profile';
    const redirectUrl = this.buildWebUrl(
      `/meriter/auth/callback?returnTo=${encodeURIComponent(redirectPath)}`,
    );

    return {
      redirectUrl,
      isNewUser: result.isNewUser,
    };
  }

  private buildWebUrl(path: string): string {
    if (!path.startsWith('/')) {
      return path;
    }
    const domain = this.configService.get('DOMAIN', 'localhost');
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const isDocker = nodeEnv === 'production';
    const protocol =
      domain === 'localhost' && !isDocker
        ? 'http'
        : domain === 'localhost'
          ? 'http'
          : 'https';
    const webPort = domain === 'localhost' ? ':8001' : '';
    return `${protocol}://${domain}${webPort}${path}`;
  }
}

export function createCompleteOAuthCallbackUseCase(deps: {
  configService: ConfigService<AppConfig>;
  authService: AuthProviderPort;
  establishSessionUseCase: EstablishSessionUseCase;
}): CompleteOAuthCallbackUseCase {
  return new CompleteOAuthCallbackUseCase(
    deps.configService,
    deps.authService,
    deps.establishSessionUseCase,
  );
}
