/**
 * BC-12 P-4: shared OTP verification attempt logic (SMS).
 * inv-24: callers preserve channel-specific TTL at send time; this helper only handles verify attempts.
 */

export type OtpAttemptRecord = {
  otpCode: string;
  attempts: number;
  verified: boolean;
  save(): Promise<unknown>;
};

export type OtpAttemptMessages = {
  notFound: string;
  maxAttemptsExceeded: string;
  invalidCode: (remainingAttempts: number) => string;
};

export const SMS_OTP_ATTEMPT_MESSAGES: OtpAttemptMessages = {
  notFound: 'No valid OTP found. Please request a new code.',
  maxAttemptsExceeded: 'Maximum verification attempts exceeded. Please request a new code.',
  invalidCode: (remainingAttempts) =>
    `Invalid code. ${remainingAttempts} attempts remaining.`,
};

/**
 * Validates a submitted OTP against a stored record, incrementing attempts on mismatch.
 * Marks the record verified and persists on success.
 */
export async function verifyOtpCodeAttempt<T extends OtpAttemptRecord>(
  otp: T | null | undefined,
  submittedCode: string,
  maxAttempts: number,
  messages: OtpAttemptMessages,
): Promise<T> {
  if (!otp) {
    throw new Error(messages.notFound);
  }

  if (otp.attempts >= maxAttempts) {
    throw new Error(messages.maxAttemptsExceeded);
  }

  if (otp.otpCode !== submittedCode) {
    otp.attempts += 1;
    await otp.save();

    const remainingAttempts = maxAttempts - otp.attempts;
    throw new Error(messages.invalidCode(remainingAttempts));
  }

  otp.verified = true;
  await otp.save();

  return otp;
}
