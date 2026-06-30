export const SMS_OTP_PROVIDER_PORT = Symbol('SMS_OTP_PROVIDER_PORT');

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
