import type { EstablishSessionRequest } from './establish-session.use-case';
import { EstablishSessionUseCase } from './establish-session.use-case';
import type { PlatformEntrepreneursDemoSeedService } from '../../../domain/services/platform-entrepreneurs-demo-seed.service';
import type { PlatformSettingsService } from '../../../domain/services/platform-settings.service';

export class DemoPersonaAuthDisabledError extends Error {
  constructor() {
    super('Demo persona login is disabled');
    this.name = 'DemoPersonaAuthDisabledError';
  }
}

export class DemoPersonaNotAllowedError extends Error {
  constructor() {
    super('Demo persona is not in the allowlist');
    this.name = 'DemoPersonaNotAllowedError';
  }
}

export class AuthenticateDemoPersonaUseCase {
  constructor(
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly entrepreneursDemoSeedService: PlatformEntrepreneursDemoSeedService,
    private readonly establishSessionUseCase: EstablishSessionUseCase,
  ) {}

  async authenticate(
    request: EstablishSessionRequest,
    response: unknown,
    authId: string,
    options: { isSuperadmin: boolean },
  ): Promise<{
    user: Awaited<
      ReturnType<EstablishSessionUseCase['authenticateDemoPersona']>
    >['user'];
    hasPendingCommunities: boolean;
  }> {
    if (!options.isSuperadmin) {
      const enabled =
        await this.platformSettingsService.getDemoPersonasEnabled();
      if (!enabled) {
        throw new DemoPersonaAuthDisabledError();
      }
    }

    if (!this.entrepreneursDemoSeedService.isAllowedDemoPersonaAuthId(authId)) {
      throw new DemoPersonaNotAllowedError();
    }

    return this.establishSessionUseCase.authenticateDemoPersona(
      response,
      request,
      authId,
    );
  }
}
