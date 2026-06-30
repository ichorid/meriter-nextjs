import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  EmailLoginLinkPort,
  EmailLoginLinkSendResult,
} from '../../../domain/ports/email-login-link.port';
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

/**
 * BC-12 inv-24: send a one-time email login link (magic link).
 * Session is established when the link is redeemed (RedeemMagicLinkUseCase).
 */
@Injectable()
export class SendEmailLoginLinkUseCase {
  constructor(
    private readonly configService: ConfigService<AppConfig>,
    private readonly emailLoginLinkService: EmailLoginLinkPort,
  ) {}

  async send(email: string | undefined): Promise<EmailLoginLinkSendResult> {
    const enabled = this.configService.get('email')?.enabled ?? false;
    if (!enabled) {
      throw new EmailAuthDisabledError();
    }
    if (!email) {
      throw new EmailRequiredError();
    }

    return this.emailLoginLinkService.sendLoginLink(email);
  }
}

export function createSendEmailLoginLinkUseCase(deps: {
  configService: ConfigService<AppConfig>;
  emailLoginLinkService: EmailLoginLinkPort;
}): SendEmailLoginLinkUseCase {
  return new SendEmailLoginLinkUseCase(deps.configService, deps.emailLoginLinkService);
}
