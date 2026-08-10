import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthProviderPort } from '../../../domain/ports/auth-provider.port';
import { AppConfig } from '../../../config/configuration';
import { EstablishSessionUseCase } from './establish-session.use-case';

export class PasskeyAuthDisabledError extends Error {
  constructor() {
    super('Passkeys disabled');
    this.name = 'PasskeyAuthDisabledError';
  }
}

export class PasskeyRegistrationIdentityRequiredError extends Error {
  constructor() {
    super('Username or userId required');
    this.name = 'PasskeyRegistrationIdentityRequiredError';
  }
}

export type FinishPasskeyRegistrationResult = {
  verified: boolean;
  user: unknown;
  jwt?: string;
};

/**
 * BC-12 inv-09: passkey registration ceremony (options + verify).
 * WebAuthn challenge persistence remains in AuthProviderService (passkey_challenges collection).
 */
@Injectable()
export class RegisterPasskeyUseCase {
  constructor(
    private readonly configService: ConfigService<AppConfig>,
    private readonly authService: AuthProviderPort,
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

  validateRegistrationIdentity(username?: string, userId?: string): void {
    if (!username && !userId) {
      throw new PasskeyRegistrationIdentityRequiredError();
    }
  }

  async startRegistration(params: {
    username?: string;
    userId?: string;
  }): Promise<unknown> {
    this.assertPasskeyAuthEnabled();
    this.validateRegistrationIdentity(params.username, params.userId);

    return this.authService.generatePasskeyRegistrationOptions(
      params.username || 'user',
      params.userId,
    );
  }

  async finishRegistration(params: {
    body: Record<string, unknown>;
    request: unknown;
    response: unknown;
  }): Promise<FinishPasskeyRegistrationResult> {
    this.assertPasskeyAuthEnabled();

    const userIdOrUsername = params.body.userId as string | undefined;
    const deviceName = params.body.deviceName as string | undefined;

    const result = await this.authService.verifyPasskeyRegistration(
      params.body,
      userIdOrUsername,
      deviceName,
    );

    if (result.jwt) {
      this.establishSessionUseCase.establishJwtSession(
        params.response,
        result.jwt,
        params.request,
      );
    }

    return {
      verified: result.verified,
      user: result.user,
      jwt: result.jwt,
    };
  }
}

export function createRegisterPasskeyUseCase(deps: {
  configService: ConfigService<AppConfig>;
  authService: AuthProviderPort;
  establishSessionUseCase: EstablishSessionUseCase;
}): RegisterPasskeyUseCase {
  return new RegisterPasskeyUseCase(
    deps.configService,
    deps.authService,
    deps.establishSessionUseCase,
  );
}
