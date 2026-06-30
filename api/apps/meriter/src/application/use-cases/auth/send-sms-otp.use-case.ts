import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsOtpProviderPort } from '../../../domain/ports/sms-otp-provider.port';
import { AppConfig } from '../../../config/configuration';

export class SmsAuthDisabledError extends Error {
  constructor() {
    super('SMS authentication is not enabled');
    this.name = 'SmsAuthDisabledError';
  }
}

export class InvalidPhoneNumberError extends Error {
  constructor(message = 'Phone number must be in E.164 format (start with +)') {
    super(message);
    this.name = 'InvalidPhoneNumberError';
  }
}

export class PhoneNumberRequiredError extends Error {
  constructor() {
    super('Phone number is required');
    this.name = 'PhoneNumberRequiredError';
  }
}

export type SendSmsOtpResult = {
  expiresIn: number;
  canResendAt: Date;
};

/**
 * BC-12 inv-24: SMS OTP send (5-minute TTL via sms.otpExpiryMinutes, default 5).
 * REST controller delegates transport responses to this use case.
 */
@Injectable()
export class SendSmsOtpUseCase {
  constructor(
    private readonly configService: ConfigService<AppConfig>,
    private readonly smsProviderService: SmsOtpProviderPort,
  ) {}

  assertSmsAuthEnabled(): void {
    const smsEnabled = this.configService.get('sms')?.enabled ?? false;
    if (!smsEnabled) {
      throw new SmsAuthDisabledError();
    }
  }

  validatePhoneNumber(phoneNumber: string | undefined): asserts phoneNumber is string {
    if (!phoneNumber) {
      throw new PhoneNumberRequiredError();
    }
    if (!phoneNumber.startsWith('+')) {
      throw new InvalidPhoneNumberError();
    }
  }

  async send(phoneNumber: string): Promise<SendSmsOtpResult> {
    this.assertSmsAuthEnabled();
    this.validatePhoneNumber(phoneNumber);

    return this.smsProviderService.sendOtp(phoneNumber);
  }
}

export function createSendSmsOtpUseCase(deps: {
  configService: ConfigService<AppConfig>;
  smsProviderService: SmsOtpProviderPort;
}): SendSmsOtpUseCase {
  return new SendSmsOtpUseCase(deps.configService, deps.smsProviderService);
}
