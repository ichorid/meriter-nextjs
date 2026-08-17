import {
  UzzRateLimiterPort,
  UzzTokenHasherPort,
  consumeUzzRateLimit,
} from '../ports/uzz-identity.port';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import {
  UzzIdentityConflictError,
  UzzInvalidTokenError,
} from '../../../domain/uzz/errors';
import { releaseHoldingRightsAfterIdentityReady } from './identity-link.helpers';

export class ConfirmTelegramLinkUseCase {
  constructor(
    private readonly unitOfWork: UzzUnitOfWork,
    private readonly tokenHasher: UzzTokenHasherPort,
    private readonly rateLimiter: UzzRateLimiterPort,
  ) {}

  async execute(input: {
    token: string;
    telegramUserId: string;
    telegramUsername: string | null;
    linkedUserId?: string;
    now?: Date;
  }): Promise<{ canonicalUserId: string }> {
    const now = input.now ?? new Date();
    const tokenHash = this.tokenHasher.hash(input.token);
    await consumeUzzRateLimit(this.rateLimiter, {
      scope: 'telegram-link-confirm',
      subjectHash: this.tokenHasher.hash(`${input.telegramUserId}:${tokenHash}`),
      limit: 5,
      windowMs: 15 * 60 * 1000,
      now,
    });

    return this.unitOfWork.run(async (repositories) => {
      const token = await repositories.identities.consumeToken(tokenHash, now, 5);
      if (!token) {
        throw new UzzInvalidTokenError('IDENTITY_TOKEN_INVALID');
      }
      const identity = await repositories.identities.findById(token.identityId);
      if (!identity) {
        throw new UzzIdentityConflictError('IDENTITY_NOT_FOUND');
      }
      const telegramOwner = await repositories.identities.findByTelegramUserId(
        input.telegramUserId,
      );
      if (telegramOwner && telegramOwner.id !== identity.id) {
        throw new UzzIdentityConflictError('IDENTITY_CONFLICT');
      }

      identity.telegramUserId = input.telegramUserId;
      identity.telegramUsername = normalizeTelegramUsername(input.telegramUsername);
      identity.updatedAt = now;
      await repositories.identities.update(identity);
      if (input.linkedUserId && input.linkedUserId !== identity.canonicalUserId) {
        const existingAlias =
          await repositories.identities.findAliasByUserId(input.linkedUserId);
        if (existingAlias && existingAlias.identityId !== identity.id) {
          throw new UzzIdentityConflictError('IDENTITY_CONFLICT');
        }
        if (!existingAlias) {
          await repositories.identities.insertAlias({
            id: `${identity.id}:${input.linkedUserId}`,
            identityId: identity.id,
            aliasUserId: input.linkedUserId,
            createdAt: now,
          });
        }
      }
      const ownerIds = [identity.canonicalUserId];
      const aliases = await repositories.identities.listAliases(identity.id);
      ownerIds.push(...aliases.map((entry) => entry.aliasUserId));
      await releaseHoldingRightsAfterIdentityReady(repositories, ownerIds, now);
      return { canonicalUserId: identity.canonicalUserId };
    });
  }
}

function normalizeTelegramUsername(value: string | null): string | null {
  const normalized = value?.trim().replace(/^@/, '') ?? '';
  return normalized || null;
}
