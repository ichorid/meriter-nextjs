import { UzzNotFoundError } from '../../../domain/uzz/errors';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { CommandExecutor } from './command-executor';
import { appendDealLedger, appendTelegramNotification, assertEquivalentActor, releaseDealLockIfHeld } from './deal-use-case.helpers';

export class CancelDealUseCase {
  private readonly commands: CommandExecutor;
  constructor(unitOfWork: UzzUnitOfWork) {
    this.commands = new CommandExecutor(unitOfWork);
  }
  execute(input: { commandId: string; dealId: string; buyerId: string; now?: Date }) {
    const now = input.now ?? new Date();
    return this.commands.execute({
      commandId: input.commandId,
      actorId: input.buyerId,
      type: 'cancel_deal',
      payload: { dealId: input.dealId },
      work: async (repositories) => {
        const deal = await repositories.deals.findById(input.dealId);
        if (!deal) throw new UzzNotFoundError('DEAL_NOT_FOUND');
        const before = deal.snapshot();
        await assertEquivalentActor(repositories, input.buyerId, before.buyerId);
        deal.cancel(before.buyerId, now);
        const state = deal.snapshot();
        await repositories.wallet.refundToSource({
          userId: state.feePayerUserId ?? state.buyerId,
          sourceCommunityId: state.feeSourceCommunityId!,
          amount: 1,
          operationId: `${input.commandId}:refund`,
        });
        deal.clearReservedFee(now);
        await releaseDealLockIfHeld(repositories, before.exchangeRightId, before.id, now);
        await repositories.deals.update(deal);
        await appendDealLedger(repositories, {
          operationId: input.commandId, communityId: state.communityId,
          userId: state.buyerId, type: 'fee_refunded', amount: 1, createdAt: now,
          metadata: { dealId: state.id, sourceCommunityId: state.feeSourceCommunityId },
        });
        await appendDealLedger(repositories, {
          operationId: input.commandId, communityId: state.communityId,
          userId: state.buyerId, type: 'deal_cancelled', amount: 0, createdAt: now,
          metadata: { dealId: state.id },
        });
        await appendTelegramNotification(repositories, {
          operationId: input.commandId, aggregateId: state.id, communityId: state.communityId,
          targetUserId: state.sellerId, kind: 'deal_cancelled',
          text: `Запрос по услуге «${state.listingSnapshot.title}» отменён`, now,
        });
        return deal.snapshot();
      },
    });
  }
}
