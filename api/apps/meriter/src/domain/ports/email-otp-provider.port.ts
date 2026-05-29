export const EMAIL_OTP_PROVIDER_PORT = Symbol('EMAIL_OTP_PROVIDER_PORT');

export type EmailOtpSendResult = {
  success: boolean;
  message?: string;
};

export type EmailOtpProviderPort = {
  sendOtp(email: string): Promise<EmailOtpSendResult>;
  verifyOtp(email: string, otpCode: string): Promise<void>;
};
