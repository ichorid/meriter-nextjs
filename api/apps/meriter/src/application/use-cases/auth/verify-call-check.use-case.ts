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
} from './send-sms-otp.use-case';

export class CallAuthDisabledError extends Error {
  constructor() {
    super('Call authentication is not enabled');
    this.name = 'CallAuthDisabledError';
  }
}

export class CallCheckParamsRequiredError extends Error {
  constructor() {
    super('checkId and phoneNumber are required');
    this.name = 'CallCheckParamsRequiredError';
  }
}

export type CallCheckStatus = 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'ERROR';

export type VerifyCallCheckResult =
  | {
      status: 'CONFIRMED';
      user: unknown;
      isNewUser: boolean;
    }
  | {
      status: Exclude<CallCheckStatus, 'CONFIRMED'>;
    };

/**
 * BC-12 inv-24: call-check status polling + auth on CONFIRMED (5-minute provider TTL).
 * Delegates status checks to SmsProviderService.verifyCallStatus.
 */
@Injectable()
export class VerifyCallCheckUseCase {
  private readonly sendSmsOtpUseCase: SendSmsOtpUseCase;

  constructor(
    private readonly configService: ConfigService<AppConfig>,
    private readonly smsProviderService: SmsOtpProviderPort,
    private readonly authService: AuthProviderPort,
    private readonly establishSessionUseCase: EstablishSessionUseCase,
  ) {
    this.sendSmsOtpUseCase = new SendSmsOtpUseCase(configService, smsProviderService);
  }

  assertCallAuthEnabled(): void {
    const enabled = this.configService.get('phone')?.enabled ?? false;
    if (!enabled) {
      throw new CallAuthDisabledError();
    }
  }

  validateInput(checkId: string | undefined, phoneNumber: string | undefined): void {
    if (!checkId || !phoneNumber) {
      throw new CallCheckParamsRequiredError();
    }
    this.sendSmsOtpUseCase.validatePhoneNumber(phoneNumber);
  }

  async verifyStatus(params: {
    checkId: string;
    phoneNumber: string;
    request: unknown;
    response: unknown;
  }): Promise<VerifyCallCheckResult> {
    this.assertCallAuthEnabled();
    this.validateInput(params.checkId, params.phoneNumber);

    const statusResult = await this.smsProviderService.verifyCallStatus(params.checkId);

    if (statusResult.status !== 'CONFIRMED') {
      return { status: statusResult.status };
    }

    const result = await this.authService.authenticateSms(params.phoneNumber);

    this.establishSessionUseCase.establishJwtSession(
      params.response,
      result.jwt,
      params.request,
    );

    return {
      status: 'CONFIRMED',
      user: result.user,
      isNewUser: result.isNewUser,
    };
  }
}

export function createVerifyCallCheckUseCase(deps: {
  configService: ConfigService<AppConfig>;
  smsProviderService: SmsOtpProviderPort;
  authService: AuthProviderPort;
  establishSessionUseCase: EstablishSessionUseCase;
}): VerifyCallCheckUseCase {
  return new VerifyCallCheckUseCase(
    deps.configService,
    deps.smsProviderService,
    deps.authService,
    deps.establishSessionUseCase,
  );
}

export { InvalidPhoneNumberError, PhoneNumberRequiredError };
