import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmailOtpProviderPort } from '../../../domain/ports/email-otp-provider.port';
import { AppConfig } from '../../../config/configuration';

export class EmailAuthDisabledError extends Error {
  constructor() {
    super('Email authentication is not enabled');
    this.name = 'EmailAuthDisabledError';
  }
}

export class EmailRequiredError extends Error {
  constructor() {
    super('Email is required');
    this.name = 'EmailRequiredError';
  }
}

export type SendEmailOtpResult = {
  expiresIn: number;
  canResendAt: number;
};

/**
 * BC-12 inv-24: email OTP send (15-minute TTL in EmailProviderService).
 * REST controller delegates transport responses to this use case.
 */
@Injectable()
export class SendEmailOtpUseCase {
  constructor(
    private readonly configService: ConfigService<AppConfig>,
    private readonly emailProviderService: EmailProviderService,
  ) {}

  assertEmailAuthEnabled(): void {
    const enabled = this.configService.get('email')?.enabled ?? false;
    if (!enabled) {
      throw new EmailAuthDisabledError();
    }
  }

  validateEmail(email: string | undefined): asserts email is string {
    if (!email) {
      throw new EmailRequiredError();
    }
  }

  async send(email: string): Promise<SendEmailOtpResult> {
    this.assertEmailAuthEnabled();
    this.validateEmail(email);

    return this.emailProviderService.sendOtp(email);
  }
}

export function createSendEmailOtpUseCase(deps: {
  configService: ConfigService<AppConfig>;
  emailProviderService: EmailOtpProviderPort;
}): SendEmailOtpUseCase {
  return new SendEmailOtpUseCase(deps.configService, deps.emailProviderService);
}
