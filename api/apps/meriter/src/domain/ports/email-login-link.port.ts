export const EMAIL_LOGIN_LINK_PORT = Symbol('EMAIL_LOGIN_LINK_PORT');

export type EmailLoginLinkSendResult = {
  /** Link lifetime in seconds */
  expiresIn: number;
  /** Unix timestamp (seconds) when resend becomes available */
  canResendAt: number;
};

export type EmailLoginLinkPort = {
  sendLoginLink(email: string): Promise<EmailLoginLinkSendResult>;
};
