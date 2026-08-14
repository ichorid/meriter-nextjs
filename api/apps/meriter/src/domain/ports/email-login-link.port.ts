export const EMAIL_LOGIN_LINK_PORT = Symbol('EMAIL_LOGIN_LINK_PORT');

export type EmailLoginLinkSendResult = {
  /** Link lifetime in seconds */
  expiresIn: number;
  /** Unix timestamp (seconds) when resend becomes available */
  canResendAt: number;
};

export type EmailLoginLinkPort = {
  sendLoginLink(
    email: string,
    options?: {
        linkToUserId?: string;
        baseUrl?: string;
        path?: string;
        productLabel?: string;
        clientIp?: string;
        now?: Date;
    },
  ): Promise<EmailLoginLinkSendResult>;
};
