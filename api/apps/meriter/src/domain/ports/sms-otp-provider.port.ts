export const SMS_OTP_PROVIDER_PORT = Symbol('SMS_OTP_PROVIDER_PORT');

/** Expected user condition: too many OTP sends within the hourly window. */
export class SmsRateLimitError extends Error {
  constructor(message = 'Rate limit exceeded. Please try again later.') {
    super(message);
    this.name = 'SmsRateLimitError';
  }
}

/** Expected user condition: OTP resend requested before cooldown elapsed. */
export class SmsResendCooldownError extends Error {
  constructor(public readonly canResendAt: Date) {
    super(`Please wait before requesting another code. Can resend at: ${canResendAt.toISOString()}`);
    this.name = 'SmsResendCooldownError';
  }
}

export type SmsOtpSendResult = {
  success: boolean;
  message?: string;
};

export type SmsCallStatusResult = {
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'ERROR';
  serverStatus: number;
};

export type SmsOtpProviderPort = {
  sendOtp(phoneNumber: string): Promise<SmsOtpSendResult>;
  verifyOtp(phoneNumber: string, otpCode: string): Promise<void>;
  verifyCallStatus(checkId: string): Promise<SmsCallStatusResult>;
};
