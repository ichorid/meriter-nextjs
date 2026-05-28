import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProviderService } from '../../../api-v1/auth/auth.service';
import { EmailProviderService } from '../../../api-v1/auth/email-provider.service';
import { AppConfig } from '../../../config/configuration';
import { EstablishSessionUseCase } from './establish-session.use-case';
import {
  EmailAuthDisabledError,
  EmailRequiredError,
  SendEmailOtpUseCase,
} from './send-email-otp.use-case';

export class EmailOtpCodeRequiredError extends Error {
  constructor() {
    super('Email and Code are required');
    this.name = 'EmailOtpCodeRequiredError';
  }
}

export type VerifyEmailOtpResult = {
  user: unknown;
  isNewUser: boolean;
};

/**
 * BC-12 inv-24: email OTP verify + session establishment.
 * Delegates OTP validation to EmailProviderService and user provisioning to AuthProviderService.authenticateEmail.
 */
@Injectable()
export class VerifyEmailOtpUseCase {
  private readonly sendEmailOtpUseCase: SendEmailOtpUseCase;

  constructor(
    configService: ConfigService<AppConfig>,
    private readonly emailProviderService: EmailProviderService,
    private readonly authService: AuthProviderService,
    private readonly establishSessionUseCase: EstablishSessionUseCase,
  ) {
    this.sendEmailOtpUseCase = new SendEmailOtpUseCase(configService, emailProviderService);
  }

  validateInput(email: string | undefined, otpCode: string | undefined): void {
    if (!email || !otpCode) {
      throw new EmailOtpCodeRequiredError();
    }
    this.sendEmailOtpUseCase.validateEmail(email);
  }

  async verify(params: {
    email: string;
    otpCode: string;
    request: unknown;
    response: unknown;
  }): Promise<VerifyEmailOtpResult> {
    this.sendEmailOtpUseCase.assertEmailAuthEnabled();
    this.validateInput(params.email, params.otpCode);

    await this.emailProviderService.verifyOtp(params.email, params.otpCode);

    const result = await this.authService.authenticateEmail(params.email);

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

export function createVerifyEmailOtpUseCase(deps: {
  configService: ConfigService<AppConfig>;
  emailProviderService: EmailProviderService;
  authService: AuthProviderService;
  establishSessionUseCase: EstablishSessionUseCase;
}): VerifyEmailOtpUseCase {
  return new VerifyEmailOtpUseCase(
    deps.configService,
    deps.emailProviderService,
    deps.authService,
    deps.establishSessionUseCase,
  );
}

export { EmailAuthDisabledError, EmailRequiredError };
