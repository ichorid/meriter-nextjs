import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProviderService } from '../../../api-v1/auth/auth.service';
import { AppConfig } from '../../../config/configuration';
import { EstablishSessionUseCase } from './establish-session.use-case';
import { PasskeyAuthDisabledError } from './register-passkey.use-case';

export type FinishPasskeyLoginResult = {
  user: unknown;
};

export type FinishPasskeyAuthenticationResult = {
  user: unknown;
  isNewUser: boolean;
};

/**
 * BC-12 inv-09: passkey login and unified authenticate ceremonies.
 * WebAuthn challenge persistence remains in AuthProviderService (passkey_challenges collection).
 */
@Injectable()
export class AuthenticatePasskeyUseCase {
  constructor(
    private readonly configService: ConfigService<AppConfig>,
    private readonly authService: AuthProviderService,
    private readonly establishSessionUseCase: EstablishSessionUseCase,
  ) {}

  isPasskeyAuthEnabled(): boolean {
    return this.configService.get('authn')?.enabled ?? false;
  }

  assertPasskeyAuthEnabled(): void {
    if (!this.isPasskeyAuthEnabled()) {
      throw new PasskeyAuthDisabledError();
    }
  }

  async startLogin(params: { username?: string }): Promise<unknown> {
    this.assertPasskeyAuthEnabled();
    return this.authService.generatePasskeyLoginOptions(params.username);
  }

  async finishLogin(params: {
    body: Record<string, unknown>;
    request: unknown;
    response: unknown;
  }): Promise<FinishPasskeyLoginResult> {
    this.assertPasskeyAuthEnabled();

    const result = await this.authService.verifyPasskeyLogin(params.body);

    this.establishSessionUseCase.establishJwtSession(
      params.response,
      result.jwt,
      params.request,
    );

    return { user: result.user };
  }

  async startAuthentication(): Promise<unknown> {
    this.assertPasskeyAuthEnabled();
    return this.authService.generatePasskeyAuthenticationOptions();
  }

  async finishAuthentication(params: {
    body: Record<string, unknown>;
    request: unknown;
    response: unknown;
  }): Promise<FinishPasskeyAuthenticationResult> {
    this.assertPasskeyAuthEnabled();

    const result = await this.authService.authenticateWithPasskey(params.body);

    this.establishSessionUseCase.establishJwtSession(
      params.response,
      result.jwt,
      params.request,
    );

    return {
      user: result.user,
      isNewUser: result.isNewUser,
    };
  }
}

export function createAuthenticatePasskeyUseCase(deps: {
  configService: ConfigService<AppConfig>;
  authService: AuthProviderService;
  establishSessionUseCase: EstablishSessionUseCase;
}): AuthenticatePasskeyUseCase {
  return new AuthenticatePasskeyUseCase(
    deps.configService,
    deps.authService,
    deps.establishSessionUseCase,
  );
}

export { PasskeyAuthDisabledError };
