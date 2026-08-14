import { randomUUID } from 'crypto';
import { ExchangeRight } from '../../../domain/uzz/entities/exchange-right';
import { UzzForbiddenError } from '../../../domain/uzz/errors';
import { Clock } from '../ports/clock.port';
import { UzzPlatformPort } from '../ports/uzz-platform.port';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { defaultSettings } from '../uzz-settings';
import { CommandExecutor } from './command-executor';
import { appendDealLedger, appendTelegramNotification } from './deal-use-case.helpers';

export class EmitExchangeRightUseCase {
  private readonly commands: CommandExecutor;
  constructor(
    private readonly unitOfWork: UzzUnitOfWork,
    private readonly platform: UzzPlatformPort,
    private readonly clock: Clock,
  ) { this.commands = new CommandExecutor(unitOfWork); }

  async execute(input: { publicationId: string }) {
    const publication = await this.platform.getPublication(input.publicationId);
    if (!publication || publication.deleted ||
        (publication.postType && publication.postType !== 'basic')) return null;
    const configuredCommunityId = this.platform.configuredCommunityId();
    if (!configuredCommunityId || publication.communityId !== configuredCommunityId) return null;
    const eligibility = await this.unitOfWork.run(async (repositories) => ({
      existing: await repositories.rights.findBySourcePublicationId(publication.id),
      settings: await repositories.settings.findByCommunityId(publication.communityId)
        ?? defaultSettings(publication.communityId, this.clock.now()),
    }));
    if (eligibility.existing) return eligibility.existing.snapshot();
    if (publication.score < eligibility.settings.emissionThreshold) return null;
    const now = this.clock.now();
    return this.commands.execute({
      commandId: `emit-right:${publication.id}`,
      actorId: publication.authorId,
      type: 'emit_exchange_right',
      payload: { publicationId: publication.id },
      work: async (repositories) => {
        const existing = await repositories.rights.findBySourcePublicationId(publication.id);
        if (existing) return existing.snapshot();
        const identity = await repositories.identities.findByCanonicalUserId(publication.authorId);
        const ready = Boolean(identity?.normalizedEmail && identity.telegramUserId);
        const right = ExchangeRight.restore({
          id: randomUUID(), communityId: publication.communityId,
          ownerId: publication.authorId, sourcePublicationId: publication.id,
          nominalRub: null, nominalAssignedAt: null, lastDemurrageAt: null,
          hopsLeft: eligibility.settings.initialHops,
          status: ready ? 'awaiting_nominal' : 'holding', lockedByDealId: null,
          ownerHistory: [{
            userId: publication.authorId, at: now,
            reason: ready ? 'emission' : 'emission_holding',
          }],
          version: 0, createdAt: now, updatedAt: now,
        });
        await repositories.rights.insert(right);
        await appendDealLedger(repositories, {
          operationId: `emit-right:${publication.id}`,
          communityId: publication.communityId, userId: publication.authorId,
          type: 'right_emitted', amount: 0, createdAt: now,
          metadata: {
            rightId: right.snapshot().id, publicationId: publication.id,
            score: publication.score,
            emissionThreshold: eligibility.settings.emissionThreshold,
            status: right.snapshot().status,
          },
        });
        await appendTelegramNotification(repositories, {
          operationId: `emit-right:${publication.id}`, communityId: publication.communityId,
          aggregateId: right.snapshot().id, targetUserId: publication.authorId,
          kind: 'right_emitted',
          text: ready
            ? 'Появилось право на обмен. Администратор назначит номинал.'
            : 'Появилось право на обмен. Привяжите email на сайте, чтобы продолжить.',
          now,
        });
        return right.snapshot();
      },
    });
  }

  async assertCanTrigger(publicationId: string, userId: string, authorization: {
    resolveUserIds(userId: string): Promise<string[]>;
    assertCommunityAdmin(communityId: string, userId: string): Promise<void>;
  }): Promise<void> {
    const publication = await this.platform.getPublication(publicationId);
    if (!publication) throw new UzzForbiddenError('PUBLICATION_NOT_FOUND');
    const ids = await authorization.resolveUserIds(userId);
    if (ids.includes(publication.authorId)) return;
    await authorization.assertCommunityAdmin(publication.communityId, userId);
  }
}
