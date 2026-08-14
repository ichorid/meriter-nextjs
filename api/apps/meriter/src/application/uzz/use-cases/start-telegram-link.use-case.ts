import {
  UzzRateLimiterPort,
  UzzTokenHasherPort,
  consumeUzzRateLimit,
} from '../ports/uzz-identity.port';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { UzzIdentityConflictError } from '../../../domain/uzz/errors';

const TELEGRAM_LINK_TTL_MS = 30 * 60 * 1000;

export class StartTelegramLinkUseCase {
  constructor(
    private readonly unitOfWork: UzzUnitOfWork,
    private readonly tokenHasher: UzzTokenHasherPort,
    private readonly rateLimiter: UzzRateLimiterPort,
  ) {}

  async execute(input: {
    userId: string;
    now?: Date;
  }): Promise<{ token: string; expiresAt: Date }> {
    const now = input.now ?? new Date();
    await consumeUzzRateLimit(this.rateLimiter, {
      scope: 'telegram-link-start',
      subjectHash: this.tokenHasher.hash(input.userId),
      limit: 3,
      windowMs: 10 * 60 * 1000,
      now,
    });
    const { token, tokenHash } = this.tokenHasher.generate();
    const expiresAt = new Date(now.getTime() + TELEGRAM_LINK_TTL_MS);

    await this.unitOfWork.run(async (repositories) => {
      const identity = await repositories.identities.findByCanonicalUserId(
        input.userId,
      );
      if (!identity) {
        throw new UzzIdentityConflictError('IDENTITY_NOT_FOUND');
      }
      await repositories.identities.insertToken({
        id: tokenHash,
        identityId: identity.id,
        purpose: 'telegram_link',
        tokenHash,
        expiresAt,
        consumedAt: null,
        attemptCount: 0,
        createdAt: now,
      });
    });

    return { token, expiresAt };
  }
}
