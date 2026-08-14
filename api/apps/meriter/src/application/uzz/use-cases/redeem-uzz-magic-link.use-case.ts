import {
  UzzEmailIdentityGateway,
  UzzMagicLinkPort,
  UzzRateLimiterPort,
  UzzTokenHasherPort,
  consumeUzzRateLimit,
} from '../ports/uzz-identity.port';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import {
  UzzIdentityConflictError,
  UzzInvalidTokenError,
} from '../../../domain/uzz/errors';

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

    const link = await this.magicLinks.redeem(input.token);
    if (!link || link.channel !== 'email') {
      throw new UzzInvalidTokenError('MAGIC_LINK_INVALID');
    }
    const normalizedEmail = link.target.trim().toLowerCase();

    if (link.linkToUserId) {
      const existing = await this.identityGateway.findUserByEmail(normalizedEmail);
      if (existing && existing.id !== link.linkToUserId) {
        throw new UzzIdentityConflictError('IDENTITY_CONFLICT');
      }
      const target = await this.identityGateway.findUserById(link.linkToUserId);
      if (!target) {
        throw new UzzIdentityConflictError('IDENTITY_NOT_FOUND');
      }
      await this.identityGateway.linkEmailIdentity(
        link.linkToUserId,
        normalizedEmail,
      );
    }

    const authenticated = await this.identityGateway.authenticateEmail(
      normalizedEmail,
    );
    if (
      link.linkToUserId &&
      authenticated.user.id !== link.linkToUserId
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
