export interface UzzMagicLinkResult {
  channel: 'sms' | 'email';
  target: string;
  linkToUserId?: string;
}

export interface UzzMagicLinkPort {
  redeem(token: string): Promise<UzzMagicLinkResult | null>;
}

export interface UzzAuthenticatedUser {
  id: string;
  displayName?: string;
}

export interface UzzEmailAuthenticationResult {
  user: UzzAuthenticatedUser;
  jwt: string;
  isNewUser?: boolean;
}

export interface UzzEmailIdentityGateway {
  authenticateEmail(email: string): Promise<UzzEmailAuthenticationResult>;
  findUserByEmail(email: string): Promise<UzzAuthenticatedUser | null>;
  linkEmailIdentity(userId: string, email: string): Promise<void>;
  findUserById(userId: string): Promise<UzzAuthenticatedUser | null>;
}

export interface UzzTokenHasherPort {
  generate(): { token: string; tokenHash: string };
  hash(token: string): string;
}

export interface UzzRateLimiterPort {
  assertAllowed(input: {
    scope: string;
    key: string;
    limit: number;
    windowMs: number;
    now: Date;
  }): void;
}
