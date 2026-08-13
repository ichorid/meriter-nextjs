import { Rubles } from '../../../domain/uzz/value-objects/rubles';
import { UzzNotFoundError } from '../../../domain/uzz/errors';
import { Clock } from '../ports/clock.port';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { CommandExecutor } from './command-executor';
import { appendDealLedger } from './deal-use-case.helpers';

export class ExpireDealsUseCase {
  private readonly commands: CommandExecutor;
  constructor(private readonly unitOfWork: UzzUnitOfWork, private readonly clock: Clock) {
    this.commands = new CommandExecutor(unitOfWork);
  }

  async executePage(input: { afterId?: string | null; limit?: number } = {}) {
    const now = this.clock.now();
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
    const candidates = await this.unitOfWork.run((repositories) =>
      repositories.deals.listDue(now, input.afterId ?? null, limit),
    );
    let processed = 0;
    for (const candidate of candidates) {
      const candidateState = candidate.snapshot();
      const deadline = candidateState.status === 'requested'
        ? candidateState.requestExpiresAt
        : candidateState.status === 'accepted'
          ? candidateState.fulfillmentExpiresAt
          : candidateState.confirmationExpiresAt;
      if (!deadline) continue;
      const commandId = `expire:${candidateState.id}:${candidateState.status}:${deadline.toISOString()}`;
      await this.commands.execute({
        commandId, actorId: 'system', type: 'expire_deal',
        work: async (repositories) => {
          const deal = await repositories.deals.findById(candidateState.id);
          if (!deal) return null;
          const before = deal.snapshot();
          const outcome = deal.expire(now);
          const right = await repositories.rights.findById(before.exchangeRightId);
          if (!right) throw new UzzNotFoundError('RIGHT_NOT_FOUND');
          const nominal = right.snapshot().nominalRub;
          if (outcome === 'closed') {
            if (nominal === null) throw new UzzNotFoundError('RIGHT_NOMINAL_MISSING');
            deal.setDealAmount(Rubles.create(nominal), now);
            right.releaseAfterDeal(before.id, before.sellerId, now);
          } else {
            if (right.snapshot().lockedByDealId === before.id) {
              right.unlockAfterDeal(before.id, now);
            }
            if (before.feeReserved && before.feeSourceCommunityId) {
              await repositories.wallet.refundToSource({
                userId: before.buyerId, sourceCommunityId: before.feeSourceCommunityId,
                amount: 1, operationId: `${commandId}:refund`,
              });
              deal.clearReservedFee(now);
              await appendDealLedger(repositories, {
                operationId: commandId, communityId: before.communityId,
                userId: before.buyerId, type: 'fee_refunded', amount: 1,
                createdAt: now, metadata: { dealId: before.id, reason: 'expired' },
              });
            }
          }
          await repositories.deals.update(deal);
          await repositories.rights.update(right);
          if (outcome === 'closed' && nominal !== null) {
            await appendDealLedger(repositories, {
              operationId: commandId, communityId: before.communityId,
              userId: before.buyerId, type: 'right_sent', amount: -nominal,
              createdAt: now, metadata: { dealId: before.id, reason: 'auto_close' },
            });
            await appendDealLedger(repositories, {
              operationId: commandId, communityId: before.communityId,
              userId: before.sellerId, type: 'right_received', amount: nominal,
              createdAt: now, metadata: { dealId: before.id, reason: 'auto_close' },
            });
          }
          await appendDealLedger(repositories, {
            operationId: commandId, communityId: before.communityId,
            userId: 'system', type: outcome === 'closed' ? 'deal_closed' : 'deal_cancelled',
            amount: 0, createdAt: now,
            metadata: { dealId: before.id, previousStatus: before.status, reason: 'expired' },
          });
          return deal.snapshot();
        },
      });
      processed += 1;
    }
    return {
      processed,
      nextAfterId: candidates.length === limit
        ? candidates[candidates.length - 1].snapshot().id
        : null,
    };
  }
}
