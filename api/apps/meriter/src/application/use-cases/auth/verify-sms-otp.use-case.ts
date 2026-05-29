import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthProviderPort } from '../../../domain/ports/auth-provider.port';
import type { SmsOtpProviderPort } from '../../../domain/ports/sms-otp-provider.port';
import { AppConfig } from '../../../config/configuration';
import { EstablishSessionUseCase } from './establish-session.use-case';
import {
  InvalidPhoneNumberError,
  PhoneNumberRequiredError,
  SendSmsOtpUseCase,
  SmsAuthDisabledError,
} from './send-sms-otp.use-case';

export class OtpCodeRequiredError extends Error {
  constructor() {
    super('Phone number and OTP code are required');
    this.name = 'OtpCodeRequiredError';
  }
}

export type VerifySmsOtpResult = {
  user: unknown;
  isNewUser: boolean;
};

/**
 * BC-12 inv-24: SMS OTP verify + session establishment.
 * Delegates OTP validation to SmsProviderService and user provisioning to AuthProviderService.authenticateSms.
 */
@Injectable()
export class VerifySmsOtpUseCase {
  private readonly sendSmsOtpUseCase: SendSmsOtpUseCase;

  constructor(
    configService: ConfigService<AppConfig>,
    private readonly smsProviderService: SmsOtpProviderPort,
    private readonly authService: AuthProviderPort,
    private readonly establishSessionUseCase: EstablishSessionUseCase,
  ) {
    this.sendSmsOtpUseCase = new SendSmsOtpUseCase(configService, smsProviderService);
  }

  validateInput(phoneNumber: string | undefined, otpCode: string | undefined): void {
    if (!phoneNumber || !otpCode) {
      throw new OtpCodeRequiredError();
    }
    this.sendSmsOtpUseCase.validatePhoneNumber(phoneNumber);
  }

  async verify(params: {
    phoneNumber: string;
    otpCode: string;
    request: unknown;
    response: unknown;
  }): Promise<VerifySmsOtpResult> {
    this.sendSmsOtpUseCase.assertSmsAuthEnabled();
    this.validateInput(params.phoneNumber, params.otpCode);

    await this.smsProviderService.verifyOtp(params.phoneNumber, params.otpCode);

    const result = await this.authService.authenticateSms(params.phoneNumber);

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

export function createVerifySmsOtpUseCase(deps: {
  configService: ConfigService<AppConfig>;
  smsProviderService: SmsOtpProviderPort;
  authService: AuthProviderPort;
  establishSessionUseCase: EstablishSessionUseCase;
}): VerifySmsOtpUseCase {
  return new VerifySmsOtpUseCase(
    deps.configService,
    deps.smsProviderService,
    deps.authService,
    deps.establishSessionUseCase,
  );
}

export {
  InvalidPhoneNumberError,
  PhoneNumberRequiredError,
  SmsAuthDisabledError,
};
