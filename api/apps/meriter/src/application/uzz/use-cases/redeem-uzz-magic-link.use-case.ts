import { randomUUID } from 'node:crypto';
import {
  UzzEmailIdentityGateway,
  UzzMagicLinkClaim,
  UzzMagicLinkPort,
  UzzRateLimiterPort,
  UzzTokenHasherPort,
  consumeUzzRateLimit,
} from '../ports/uzz-identity.port';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import {
  UzzConflictError,
  UzzIdentityConflictError,
  UzzInvalidTokenError,
} from '../../../domain/uzz/errors';
import { isIdentityReady } from '../policies/uzz-access-policy';
import { releaseHoldingRightsAfterIdentityReady } from './identity-link.helpers';

const MAGIC_LINK_CLAIM_LEASE_MS = 120_000;

export class RedeemUzzMagicLinkUseCase {
  constructor(
    private readonly magicLinks: UzzMagicLinkPort,
    private readonly identityGateway: UzzEmailIdentityGateway,
    private readonly unitOfWork: UzzUnitOfWork,
    private readonly tokenHasher: UzzTokenHasherPort,
    private readonly rateLimiter: UzzRateLimiterPort,
  ) {}

  async execute(input: { token: string; ip: string; now?: Date }) {
    const now = input.now ?? new Date();
    const tokenHash = this.tokenHasher.hash(input.token);
    await consumeUzzRateLimit(this.rateLimiter, {
      scope: 'magic-link-redeem-ip',
      subjectHash: this.tokenHasher.hash(input.ip),
      limit: 20,
      windowMs: 15 * 60 * 1000,
      now,
    });
    await consumeUzzRateLimit(this.rateLimiter, {
      scope: 'magic-link-redeem-token',
      subjectHash: tokenHash,
      limit: 10,
      windowMs: 15 * 60 * 1000,
      now,
    });

    const claimId = randomUUID();
    const claim = await this.magicLinks.claim(
      input.token,
      claimId,
      now,
      MAGIC_LINK_CLAIM_LEASE_MS,
    );
    if (!claim) {
      throw new UzzInvalidTokenError('MAGIC_LINK_INVALID');
    }
    try {
      const result = await this.authenticateAndPersistIdentity(claim, now);
      if (!(await this.magicLinks.finalize(claimId, now))) {
        throw new UzzConflictError('MAGIC_LINK_CLAIM_LOST');
      }
      return result;
    } catch (error) {
      if (isRetryableAuthenticationFailure(error)) {
        await this.magicLinks.release(claimId);
      } else if (!isMagicLinkClaimLost(error)) {
        await this.magicLinks.finalize(claimId, now);
      }
      throw error;
    }
  }

  private async authenticateAndPersistIdentity(
    claim: UzzMagicLinkClaim,
    now: Date,
  ) {
    if (claim.channel !== 'email') {
      throw new UzzInvalidTokenError('MAGIC_LINK_INVALID');
    }
    const normalizedEmail = claim.target.trim().toLowerCase();

    if (claim.linkToUserId) {
      const existing = await this.identityGateway.findUserByEmail(normalizedEmail);
      if (existing && existing.id !== claim.linkToUserId) {
        throw new UzzIdentityConflictError('IDENTITY_CONFLICT');
      }
      const target = await this.identityGateway.findUserById(claim.linkToUserId);
      if (!target) {
        throw new UzzIdentityConflictError('IDENTITY_NOT_FOUND');
      }
      await this.identityGateway.linkEmailIdentity(
        claim.linkToUserId,
        normalizedEmail,
      );
    }

    const authenticated = await this.identityGateway.authenticateEmail(
      normalizedEmail,
    );
    if (
      claim.linkToUserId &&
      authenticated.user.id !== claim.linkToUserId
    ) {
      throw new UzzIdentityConflictError('IDENTITY_CONFLICT');
    }

    await this.unitOfWork.run(async (repositories) => {
      const byEmail = await repositories.identities.findByEmail(normalizedEmail);
      const byUser = await repositories.identities.findByCanonicalUserId(
        authenticated.user.id,
      );
      if (byEmail && byEmail.canonicalUserId !== authenticated.user.id) {
        throw new UzzIdentityConflictError('IDENTITY_CONFLICT');
      }
      if (
        byUser?.normalizedEmail &&
        byUser.normalizedEmail !== normalizedEmail
      ) {
        throw new UzzIdentityConflictError('IDENTITY_CONFLICT');
      }
      if (byUser) {
        byUser.normalizedEmail = normalizedEmail;
        byUser.updatedAt = now;
        await repositories.identities.update(byUser);
        if (isIdentityReady(byUser)) {
          const aliases = await repositories.identities.listAliases(byUser.id);
          await releaseHoldingRightsAfterIdentityReady(
            repositories,
            [byUser.canonicalUserId, ...aliases.map((entry) => entry.aliasUserId)],
            now,
          );
        }
        return;
      }
      if (!byEmail) {
        await repositories.identities.insert({
          id: `identity:${authenticated.user.id}`,
          canonicalUserId: authenticated.user.id,
          normalizedEmail,
          telegramUserId: null,
          telegramUsername: null,
          createdAt: now,
          updatedAt: now,
          version: 0,
        });
      }
    });

    return {
      user: authenticated.user,
      jwt: authenticated.jwt,
      isNewUser: authenticated.isNewUser ?? false,
      email: normalizedEmail,
    };
  }
}

function isMagicLinkClaimLost(error: unknown): boolean {
  return error instanceof UzzConflictError && error.code === 'MAGIC_LINK_CLAIM_LOST';
}

function isRetryableAuthenticationFailure(error: unknown): boolean {
  return !(
    error instanceof UzzIdentityConflictError ||
    error instanceof UzzInvalidTokenError ||
    error instanceof UzzConflictError
  );
}
