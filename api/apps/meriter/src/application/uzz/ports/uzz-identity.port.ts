import { UzzRateLimitedError } from '../../../domain/uzz/errors';

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

export const UZZ_RATE_LIMITER_PORT = Symbol('UZZ_RATE_LIMITER_PORT');

export type RateLimitConsumeInput = {
  scope: string;
  subjectHash: string;
  limit: number;
  windowMs: number;
  now: Date;
};

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

export interface UzzRateLimiterPort {
  consume(input: RateLimitConsumeInput): Promise<RateLimitDecision>;
}

export function retryAfterSeconds(resetAt: Date, now: Date): number {
  return Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000));
}

export async function consumeUzzRateLimit(
  limiter: UzzRateLimiterPort,
  input: RateLimitConsumeInput,
): Promise<void> {
  const decision = await limiter.consume(input);
  if (!decision.allowed) {
    throw new UzzRateLimitedError('UZZ_RATE_LIMITED', 'UZZ_RATE_LIMITED', {
      retryAfterSeconds: retryAfterSeconds(decision.resetAt, input.now),
    });
  }
}
