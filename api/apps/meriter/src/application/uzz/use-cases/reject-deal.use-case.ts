import { UzzNotFoundError } from '../../../domain/uzz/errors';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { CommandExecutor } from './command-executor';
import { appendDealLedger, appendTelegramNotification, assertEquivalentActor } from './deal-use-case.helpers';

export class RejectDealUseCase {
  private readonly commands: CommandExecutor;
  constructor(unitOfWork: UzzUnitOfWork) {
    this.commands = new CommandExecutor(unitOfWork);
  }
  execute(input: { commandId: string; dealId: string; sellerId: string; now?: Date }) {
    const now = input.now ?? new Date();
    return this.commands.execute({
      commandId: input.commandId,
      actorId: input.sellerId,
      type: 'reject_deal',
      work: async (repositories) => {
        const deal = await repositories.deals.findById(input.dealId);
        if (!deal) throw new UzzNotFoundError('DEAL_NOT_FOUND');
        const before = deal.snapshot();
        await assertEquivalentActor(repositories, input.sellerId, before.sellerId);
        deal.reject(before.sellerId, now);
        const state = deal.snapshot();
        await repositories.wallet.refundToSource({
          userId: state.feePayerUserId ?? state.buyerId,
          sourceCommunityId: state.feeSourceCommunityId!,
          amount: 1,
          operationId: `${input.commandId}:refund`,
        });
        deal.clearReservedFee(now);
        await repositories.deals.update(deal);
        await appendDealLedger(repositories, {
          operationId: input.commandId, communityId: state.communityId,
          userId: state.buyerId, type: 'fee_refunded', amount: 1, createdAt: now,
          metadata: { dealId: state.id, sourceCommunityId: state.feeSourceCommunityId },
        });
        await appendDealLedger(repositories, {
          operationId: input.commandId, communityId: state.communityId,
          userId: state.sellerId, type: 'deal_rejected', amount: 0, createdAt: now,
          metadata: { dealId: state.id },
        });
        await appendTelegramNotification(repositories, {
          operationId: input.commandId, aggregateId: state.id,
          targetUserId: state.buyerId, kind: 'deal_rejected',
          text: `Запрос по услуге «${state.listingSnapshot.title}» отклонён`, now,
        });
        return deal.snapshot();
      },
    });
  }
}
