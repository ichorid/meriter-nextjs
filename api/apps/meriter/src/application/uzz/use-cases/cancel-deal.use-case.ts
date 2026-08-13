import { UzzNotFoundError } from '../../../domain/uzz/errors';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { CommandExecutor } from './command-executor';
import { appendDealLedger } from './deal-use-case.helpers';

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
      work: async (repositories) => {
        const deal = await repositories.deals.findById(input.dealId);
        if (!deal) throw new UzzNotFoundError('DEAL_NOT_FOUND');
        deal.cancel(input.buyerId, now);
        const state = deal.snapshot();
        await repositories.wallet.refundToSource({
          userId: state.buyerId,
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
          userId: input.buyerId, type: 'deal_cancelled', amount: 0, createdAt: now,
          metadata: { dealId: state.id },
        });
        return deal.snapshot();
      },
    });
  }
}
